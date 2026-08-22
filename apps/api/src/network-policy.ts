import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

export type AddressResolver = (hostname: string) => Promise<Array<{ address: string }>>;

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa"];
const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "instance-data.ec2.internal",
  "169.254.169.254",
  "fd00:ec2::254",
]);

export class UnsafeUrlError extends Error {
  constructor(message = "The URL does not resolve to a public internet address.") {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export function createPublicUrlPolicy(): (value: string) => Promise<boolean> {
  return async (value: string): Promise<boolean> => {
    try {
      await resolvePublicTarget(value);
      return true;
    } catch {
      return false;
    }
  };
}

export async function assertPublicUrl(value: string): Promise<URL> {
  const url = parseHttpUrl(value);
  await resolvePublicTarget(url.toString());
  return url;
}

export async function resolvePublicTarget(
  value: string,
  resolver: AddressResolver = systemResolver,
): Promise<{ url: URL; addresses: string[] }> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UnsafeUrlError();
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new UnsafeUrlError();
  if (url.username || url.password) throw new UnsafeUrlError();
  if (url.port && !["80", "443"].includes(url.port)) throw new UnsafeUrlError();

  const hostname = canonicalHostname(url.hostname);
  if (!hostname || BLOCKED_HOSTS.has(hostname) || BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) throw new UnsafeUrlError();
  const addresses = await resolvePublicAddresses(hostname, resolver);
  if (addresses.length === 0 || addresses.some((address) => !isPublicAddress(address))) throw new UnsafeUrlError();
  return { url, addresses };
}

export function parseHttpUrl(value: string): URL {
  let url: URL;
  try {
    if (/^[a-z][a-z\d+.-]*:\/\//i.test(value) && !/^https?:\/\//i.test(value)) throw new TypeError("Unsupported protocol");
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    throw new UnsafeUrlError("Enter a valid website URL.");
  }

  return url;
}

async function resolvePublicAddresses(hostname: string, resolver: AddressResolver): Promise<string[]> {
  if (ipaddr.isValid(hostname)) return [hostname];
  try {
    return (await resolver(hostname)).map(({ address }) => address);
  } catch {
    return [];
  }
}

const systemResolver: AddressResolver = (hostname) => lookup(hostname, { all: true, verbatim: true });

export function canonicalHostname(hostname: string): string {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return normalized.startsWith("[") && normalized.endsWith("]")
    ? normalized.slice(1, -1)
    : normalized;
}

export function isPublicAddress(value: string): boolean {
  try {
    let address = ipaddr.parse(value);
    if (address instanceof ipaddr.IPv6 && address.isIPv4MappedAddress()) address = address.toIPv4Address();
    return address.range() === "unicast";
  } catch {
    return false;
  }
}

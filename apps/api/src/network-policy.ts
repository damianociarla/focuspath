import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

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
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return false;
    }

    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (url.username || url.password) return false;
    if (url.port && !["80", "443"].includes(url.port)) return false;

    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!hostname || BLOCKED_HOSTS.has(hostname) || BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return false;
    // Resolve every request instead of trusting an earlier result for the hostname.
    // Infrastructure-level egress filtering is still required to fully close DNS rebinding TOCTOU.
    return resolvesOnlyToPublicAddresses(hostname);
  };
}

export async function assertPublicUrl(value: string): Promise<URL> {
  const url = parseHttpUrl(value);
  const policy = createPublicUrlPolicy();
  if (!(await policy(url.toString()))) throw new UnsafeUrlError();
  return url;
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

async function resolvesOnlyToPublicAddresses(hostname: string): Promise<boolean> {
  if (ipaddr.isValid(hostname)) return isPublicAddress(hostname);

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every(({ address }) => isPublicAddress(address));
  } catch {
    return false;
  }
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

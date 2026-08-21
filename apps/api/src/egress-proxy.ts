import { createServer, request as requestHttp, type ClientRequest, type IncomingHttpHeaders, type Server as HttpServer } from "node:http";
import { connect, type Socket } from "node:net";
import type { Duplex } from "node:stream";
import { resolvePublicTarget, type AddressResolver, UnsafeUrlError } from "./network-policy.js";

export interface PinnedEgressProxy {
  url: string;
  close: () => Promise<void>;
}

export async function startPinnedEgressProxy(resolver?: AddressResolver): Promise<PinnedEgressProxy> {
  const server = createServer(async (request, response) => {
    try {
      if (!request.url) throw new UnsafeUrlError();
      const target = await resolvePublicTarget(request.url, resolver);
      if (target.url.protocol !== "http:") throw new UnsafeUrlError();
      const upstream = requestPinned(preferredAddresses(target.addresses)[0]!, Number(target.url.port || 80), {
        method: request.method ?? "GET",
        path: `${target.url.pathname}${target.url.search}`,
        headers: forwardedHeaders(request.headers, target.url.host),
      });
      upstream.once("response", (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
        upstreamResponse.pipe(response);
      });
      upstream.once("error", () => {
        if (!response.headersSent) response.writeHead(502, { connection: "close" });
        response.end();
      });
      request.pipe(upstream);
    } catch {
      response.writeHead(403, { "content-type": "text/plain", connection: "close" }).end("Blocked by FocusPath egress policy.");
    }
  });

  server.on("connect", async (request, clientSocket, head) => {
    try {
      const authority = parseAuthority(request.url ?? "");
      const target = await resolvePublicTarget(`https://${authority.hostname}:${authority.port}`, resolver);
      const upstream = await connectPinned(target.addresses, authority.port);
      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length > 0) upstream.write(head);
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
      closeTogether(clientSocket, upstream);
    } catch {
      clientSocket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    }
  });

  server.on("upgrade", (_request, socket) => {
    socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
  });

  await listen(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start the pinned egress proxy.");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

function parseAuthority(authority: string): { hostname: string; port: number } {
  const url = new URL(`https://${authority}`);
  const port = Number(url.port || 443);
  if (port !== 443 || url.username || url.password || url.pathname !== "/") throw new UnsafeUrlError();
  return { hostname: url.hostname, port };
}

function forwardedHeaders(headers: IncomingHttpHeaders, host: string): IncomingHttpHeaders {
  const forwarded: Record<string, string | string[] | undefined> = { ...headers, host };
  delete forwarded["proxy-authorization"];
  delete forwarded["proxy-connection"];
  return forwarded;
}

function requestPinned(
  address: string,
  port: number,
  options: { method: string; path: string; headers: IncomingHttpHeaders },
): ClientRequest {
  return requestHttp({
    hostname: address,
    port,
    method: options.method,
    path: options.path,
    headers: options.headers,
    family: address.includes(":") ? 6 : 4,
  });
}

async function connectPinned(addresses: string[], port: number): Promise<Socket> {
  let lastError: Error | undefined;
  for (const address of preferredAddresses(addresses)) {
    try {
      return await new Promise((resolve, reject) => {
        const socket = connect({ host: address, port, family: address.includes(":") ? 6 : 4 });
        socket.setTimeout(5_000, () => socket.destroy(new Error("Pinned connection timed out.")));
        socket.once("connect", () => {
          socket.setTimeout(0);
          resolve(socket);
        });
        socket.once("error", reject);
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error("No public address was reachable.");
}

function preferredAddresses(addresses: string[]): string[] {
  return [...addresses].sort((left, right) => Number(left.includes(":")) - Number(right.includes(":")));
}

function closeTogether(first: Duplex, second: Duplex): void {
  first.once("error", () => second.destroy());
  second.once("error", () => first.destroy());
  first.once("close", () => second.destroy());
  second.once("close", () => first.destroy());
}

function listen(server: HttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
}

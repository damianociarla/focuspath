import { Agent, createServer, request as requestHttp, type ClientRequest, type IncomingHttpHeaders, type IncomingMessage, type Server as HttpServer, type ServerResponse } from "node:http";
import { connect, Socket } from "node:net";
import type { Duplex } from "node:stream";
import { resolvePublicTarget, type AddressResolver, UnsafeUrlError } from "./network-policy.js";

const DEFAULT_REQUEST_TIMEOUT_MS = 12_000;
const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;
const DEFAULT_INACTIVITY_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_ADDRESSES = 4;

type PinnedTarget = { url: URL; addresses: string[] };

export interface PinnedEgressProxyOptions {
  resolver?: AddressResolver;
  requestTimeoutMs?: number;
  connectTimeoutMs?: number;
  inactivityTimeoutMs?: number;
  maxAddresses?: number;
  /** Dependency injection for deterministic socket tests. Production uses resolvePublicTarget. */
  targetResolver?: (value: string) => Promise<PinnedTarget>;
}

export interface PinnedEgressProxy {
  url: string;
  close: () => Promise<void>;
}

export async function startPinnedEgressProxy(options: PinnedEgressProxyOptions = {}): Promise<PinnedEgressProxy> {
  const requestTimeoutMs = positiveTimeout(options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
  const connectTimeoutMs = positiveTimeout(options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS);
  const inactivityTimeoutMs = positiveTimeout(options.inactivityTimeoutMs ?? DEFAULT_INACTIVITY_TIMEOUT_MS);
  const maxAddresses = positiveInteger(options.maxAddresses ?? DEFAULT_MAX_ADDRESSES);
  const targetResolver = options.targetResolver ?? ((value: string) => resolvePublicTarget(value, options.resolver));

  const server = createServer((request, response) => {
    void handleHttpRequest(request, response, {
      targetResolver,
      requestTimeoutMs,
      connectTimeoutMs,
      inactivityTimeoutMs,
      maxAddresses,
    });
  });
  server.on("connect", (request, clientSocket, head) => {
    void handleHttpsTunnel(request.url ?? "", clientSocket, head, {
      targetResolver,
      connectTimeoutMs,
      inactivityTimeoutMs,
      maxAddresses,
    });
  });
  server.on("upgrade", (_request, socket) => {
    socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
  });
  const downstreamSockets = new Set<Socket>();
  server.on("connection", (socket) => {
    downstreamSockets.add(socket);
    socket.once("close", () => downstreamSockets.delete(socket));
  });

  await listen(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start the pinned egress proxy.");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      for (const socket of downstreamSockets) socket.destroy();
      server.closeAllConnections();
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

interface ProxyRuntimeOptions {
  targetResolver: (value: string) => Promise<PinnedTarget>;
  connectTimeoutMs: number;
  inactivityTimeoutMs: number;
  maxAddresses: number;
}

async function handleHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: ProxyRuntimeOptions & { requestTimeoutMs: number },
): Promise<void> {
  const controller = new AbortController();
  let upstream: ClientRequest | undefined;
  let upstreamSocket: Socket | undefined;
  let deadlineExpired = false;
  const deadline = setTimeout(() => {
    deadlineExpired = true;
    controller.abort(new Error("Pinned HTTP request deadline exceeded."));
  }, options.requestTimeoutMs);
  const cancel = () => controller.abort(new Error("Proxy client disconnected."));
  request.once("aborted", cancel);
  const handleResponseClose = () => {
    if (!response.writableEnded) cancel();
    cleanup();
  };
  controller.signal.addEventListener("abort", () => {
    upstream?.destroy(controller.signal.reason);
    upstreamSocket?.destroy(controller.signal.reason);
  }, { once: true });

  const cleanup = () => {
    clearTimeout(deadline);
    request.off("aborted", cancel);
  };
  response.once("close", handleResponseClose);
  response.once("finish", cleanup);

  try {
    if (!request.url) throw new UnsafeUrlError();
    const target = await abortable(options.targetResolver(request.url), controller.signal);
    if (target.url.protocol !== "http:") throw new UnsafeUrlError();
    upstreamSocket = await connectPinned(target.addresses, Number(target.url.port || 80), {
      signal: controller.signal,
      timeoutMs: options.connectTimeoutMs,
      maxAddresses: options.maxAddresses,
    });
    if (controller.signal.aborted) return;

    const pinnedAgent = new Agent({ keepAlive: false });
    pinnedAgent.createConnection = () => upstreamSocket!;
    upstream = requestHttp({
      hostname: target.url.hostname,
      port: Number(target.url.port || 80),
      method: request.method ?? "GET",
      path: `${target.url.pathname}${target.url.search}`,
      headers: forwardedHeaders(request.headers, target.url.host),
      agent: pinnedAgent,
      signal: controller.signal,
    });
    upstream.setTimeout(options.inactivityTimeoutMs, () => {
      deadlineExpired = true;
      controller.abort(new Error("Pinned HTTP upstream became inactive."));
    });
    upstream.once("response", (upstreamResponse) => {
      upstreamResponse.setTimeout(options.inactivityTimeoutMs, () => {
        deadlineExpired = true;
        controller.abort(new Error("Pinned HTTP response became inactive."));
      });
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.once("error", () => {
        if (!response.writableEnded) response.destroy();
      });
      upstreamResponse.pipe(response);
    });
    upstream.once("error", (error) => {
      if (response.headersSent) {
        if (!response.writableEnded) response.destroy(error);
      } else if (!response.writableEnded) {
        response.writeHead(deadlineExpired ? 504 : 502, { connection: "close" }).end();
      }
      if (!controller.signal.aborted) upstreamSocket?.destroy(error);
    });
    request.pipe(upstream);
  } catch (error) {
    cleanup();
    if (response.writableEnded || response.destroyed) return;
    if (error instanceof UnsafeUrlError) {
      response.writeHead(403, { "content-type": "text/plain", connection: "close" }).end("Blocked by FocusPath egress policy.");
    } else {
      response.writeHead(deadlineExpired ? 504 : 502, { connection: "close" }).end();
    }
  }
}

async function handleHttpsTunnel(
  authorityValue: string,
  clientSocket: Duplex,
  head: Buffer,
  options: ProxyRuntimeOptions,
): Promise<void> {
  const controller = new AbortController();
  const connectDeadlineAt = Date.now() + options.connectTimeoutMs;
  const connectDeadline = setTimeout(() => controller.abort(new Error("Pinned HTTPS connection deadline exceeded.")), options.connectTimeoutMs);
  const cancel = () => controller.abort(new Error("HTTPS proxy client disconnected."));
  clientSocket.once("close", cancel);
  try {
    const authority = parseAuthority(authorityValue);
    const target = await abortable(options.targetResolver(`https://${authority.hostname}:${authority.port}`), controller.signal);
    const upstream = await connectPinned(target.addresses, authority.port, {
      signal: controller.signal,
      timeoutMs: Math.max(1, connectDeadlineAt - Date.now()),
      maxAddresses: options.maxAddresses,
    });
    if (controller.signal.aborted) {
      upstream.destroy(controller.signal.reason);
      return;
    }
    clearTimeout(connectDeadline);
    setInactivityTimeout(clientSocket, options.inactivityTimeoutMs);
    setInactivityTimeout(upstream, options.inactivityTimeoutMs);
    clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    if (head.length > 0) upstream.write(head);
    upstream.pipe(clientSocket);
    clientSocket.pipe(upstream);
    closeTogether(clientSocket, upstream);
  } catch {
    if (!clientSocket.destroyed) clientSocket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
  } finally {
    clearTimeout(connectDeadline);
    clientSocket.off("close", cancel);
  }
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

async function connectPinned(
  addresses: string[],
  port: number,
  options: { signal: AbortSignal; timeoutMs: number; maxAddresses: number },
): Promise<Socket> {
  const candidates = preferredAddresses(addresses).slice(0, options.maxAddresses);
  if (candidates.length === 0) throw new Error("No public address was available.");
  let lastError: Error | undefined;
  const attemptTimeoutMs = Math.max(1, Math.ceil(options.timeoutMs / candidates.length));
  for (const address of candidates) {
    if (options.signal.aborted) throw abortError(options.signal);
    try {
      return await connectOne(address, port, attemptTimeoutMs, options.signal);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error("No public address was reachable.");
}

function connectOne(address: string, port: number, timeoutMs: number, signal: AbortSignal): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: address, port, family: address.includes(":") ? 6 : 4 });
    const timeout = setTimeout(() => socket.destroy(new Error("Pinned connection timed out.")), timeoutMs);
    const onAbort = () => socket.destroy(abortError(signal));
    const cleanup = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    socket.once("connect", () => {
      cleanup();
      resolve(socket);
    });
    socket.once("error", (error) => {
      cleanup();
      reject(error);
    });
  });
}

function setInactivityTimeout(socket: Duplex, timeoutMs: number): void {
  if (!(socket instanceof Socket)) return;
  socket.setTimeout(timeoutMs, () => socket.destroy(new Error("Pinned tunnel became inactive.")));
}

function preferredAddresses(addresses: string[]): string[] {
  return [...new Set(addresses)].sort((left, right) => Number(left.includes(":")) - Number(right.includes(":")));
}

function closeTogether(first: Duplex, second: Duplex): void {
  first.once("error", () => second.destroy());
  second.once("error", () => first.destroy());
  first.once("close", () => second.destroy());
  second.once("close", () => first.destroy());
}

function abortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error("Pinned connection aborted.");
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError(signal));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function positiveTimeout(value: number): number {
  if (!Number.isFinite(value) || value < 1) throw new TypeError("Proxy timeouts must be positive numbers.");
  return value;
}

function positiveInteger(value: number): number {
  if (!Number.isInteger(value) || value < 1) throw new TypeError("maxAddresses must be a positive integer.");
  return value;
}

function listen(server: HttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
}

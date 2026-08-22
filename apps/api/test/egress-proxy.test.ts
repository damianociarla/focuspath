import { createServer, request, type IncomingMessage, type ServerResponse } from "node:http";
import { connect } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startPinnedEgressProxy, type PinnedEgressProxy } from "../src/egress-proxy.js";

let proxy: PinnedEgressProxy;

beforeAll(async () => {
  proxy = await startPinnedEgressProxy({ resolver: async () => [{ address: "127.0.0.1" }] });
});

afterAll(async () => {
  await proxy.close();
});

describe("pinned egress proxy", () => {
  it("blocks an HTTP request whose pinned resolution becomes private", async () => {
    const response = await proxyRequest("http://rebind.example/private");
    expect(response.status).toBe(403);
    expect(response.body).toContain("Blocked by FocusPath egress policy");
  });

  it("blocks an HTTPS tunnel whose pinned resolution becomes private", async () => {
    const response = await proxyConnect("rebind.example:443");
    expect(response).toContain("403 Forbidden");
  });

  it("terminates a silent HTTP upstream at the overall request deadline", async () => {
    const upstream = await startHttpServer(() => undefined);
    const isolated = await startPinnedEgressProxy({
      targetResolver: localTargetResolver(upstream.port),
      requestTimeoutMs: 100,
      connectTimeoutMs: 50,
      inactivityTimeoutMs: 50,
    });
    try {
      const started = Date.now();
      const response = await proxyRequest("http://upstream.test/silent", isolated);
      expect(response.status).toBe(504);
      expect(Date.now() - started).toBeLessThan(1_000);
    } finally {
      await isolated.close();
      await upstream.close();
    }
  });

  it("bounds a target resolution that never completes", async () => {
    const isolated = await startPinnedEgressProxy({
      targetResolver: () => new Promise(() => undefined),
      requestTimeoutMs: 50,
    });
    try {
      const response = await proxyRequest("http://slow-dns.test/", isolated);
      expect(response.status).toBe(504);
    } finally {
      await isolated.close();
    }
  });

  it("destroys the HTTP upstream when the proxy client disconnects", async () => {
    let markUpstreamStarted!: () => void;
    let markUpstreamClosed!: () => void;
    const upstreamStarted = new Promise<void>((resolve) => markUpstreamStarted = resolve);
    const upstreamClosed = new Promise<void>((resolve) => markUpstreamClosed = resolve);
    const upstream = await startHttpServer((request) => {
      markUpstreamStarted();
      request.socket.once("close", markUpstreamClosed);
    });
    const isolated = await startPinnedEgressProxy({
      targetResolver: localTargetResolver(upstream.port),
      requestTimeoutMs: 2_000,
    });
    try {
      const proxyUrl = new URL(isolated.url);
      const client = connect(Number(proxyUrl.port), proxyUrl.hostname);
      await new Promise<void>((resolve, reject) => {
        client.once("connect", () => {
          client.write("GET http://upstream.test/hang HTTP/1.1\r\nHost: upstream.test\r\n\r\n");
          resolve();
        });
        client.once("error", reject);
      });
      await upstreamStarted;
      client.destroy();
      await expect(Promise.race([
        upstreamClosed.then(() => true),
        new Promise<false>((resolve) => setTimeout(() => resolve(false), 500)),
      ])).resolves.toBe(true);
    } finally {
      await isolated.close();
      await upstream.close();
    }
  });

  it("terminates an HTTP response whose body becomes inactive", async () => {
    const upstream = await startHttpServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      response.write("partial");
    });
    const isolated = await startPinnedEgressProxy({
      targetResolver: localTargetResolver(upstream.port),
      requestTimeoutMs: 1_000,
      inactivityTimeoutMs: 50,
    });
    try {
      await expect(proxyRequest("http://upstream.test/inactive", isolated)).rejects.toThrow("aborted");
    } finally {
      await isolated.close();
      await upstream.close();
    }
  });

  it("falls back to the next pinned address for HTTP", async () => {
    const upstream = await startHttpServer((_request, response) => response.end("fallback reached"));
    const isolated = await startPinnedEgressProxy({
      targetResolver: localTargetResolver(upstream.port, ["127.0.0.2", "127.0.0.1"]),
      connectTimeoutMs: 200,
    });
    try {
      const response = await proxyRequest("http://upstream.test/fallback", isolated);
      expect(response).toEqual({ status: 200, body: "fallback reached" });
    } finally {
      await isolated.close();
      await upstream.close();
    }
  });

  it("never tries more than the configured pinned address budget", async () => {
    const upstream = await startHttpServer((_request, response) => response.end("must not be reached"));
    const isolated = await startPinnedEgressProxy({
      targetResolver: localTargetResolver(upstream.port, ["127.0.0.2", "127.0.0.1"]),
      connectTimeoutMs: 100,
      maxAddresses: 1,
    });
    try {
      const response = await proxyRequest("http://upstream.test/bounded", isolated);
      expect(response.status).toBe(502);
    } finally {
      await isolated.close();
      await upstream.close();
    }
  });
});

async function proxyRequest(target: string, selectedProxy = proxy): Promise<{ status: number; body: string }> {
  const proxyUrl = new URL(selectedProxy.url);
  return new Promise((resolve, reject) => {
    const outgoing = request({
      hostname: proxyUrl.hostname,
      port: proxyUrl.port,
      method: "GET",
      path: target,
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => body += chunk);
      response.on("end", () => resolve({ status: response.statusCode ?? 0, body }));
      response.once("aborted", () => reject(new Error("Proxy response aborted.")));
      response.once("error", reject);
    });
    outgoing.once("error", reject);
    outgoing.end();
  });
}

function localTargetResolver(port: number, addresses = ["127.0.0.1"]) {
  return async (value: string) => {
    const url = new URL(value);
    url.port = String(port);
    return { url, addresses };
  };
}

async function startHttpServer(handler: (request: IncomingMessage, response: ServerResponse) => void): Promise<{ port: number; close: () => Promise<void> }> {
  const server = createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start HTTP test server.");
  return {
    port: address.port,
    close: () => new Promise((resolve, reject) => {
      server.closeAllConnections();
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

async function proxyConnect(authority: string): Promise<string> {
  const proxyUrl = new URL(proxy.url);
  return new Promise((resolve, reject) => {
    const socket = connect(Number(proxyUrl.port), proxyUrl.hostname);
    let response = "";
    socket.setEncoding("utf8");
    socket.once("connect", () => socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`));
    socket.on("data", (chunk) => response += chunk);
    socket.once("end", () => resolve(response));
    socket.once("error", reject);
  });
}

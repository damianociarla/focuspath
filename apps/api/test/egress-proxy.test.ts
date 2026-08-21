import { request } from "node:http";
import { connect } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startPinnedEgressProxy, type PinnedEgressProxy } from "../src/egress-proxy.js";

let proxy: PinnedEgressProxy;

beforeAll(async () => {
  proxy = await startPinnedEgressProxy(async () => [{ address: "127.0.0.1" }]);
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
});

async function proxyRequest(target: string): Promise<{ status: number; body: string }> {
  const proxyUrl = new URL(proxy.url);
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
    });
    outgoing.once("error", reject);
    outgoing.end();
  });
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

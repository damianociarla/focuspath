import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let api: ChildProcess;
let baseUrl: string;

beforeAll(async () => {
  const port = await availablePort();
  baseUrl = `http://127.0.0.1:${port}`;
  api = spawn(process.execPath, [fileURLToPath(new URL("../../../node_modules/tsx/dist/cli.mjs", import.meta.url)), "src/server.ts"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    env: {
      ...process.env,
      PORT: String(port),
      ORIGIN_VERIFY_TOKEN: "",
      ALLOWED_ORIGINS: "http://127.0.0.1:5173",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("API did not start in time")), 5_000);
    api.once("error", reject);
    api.once("exit", (code) => reject(new Error(`API exited before startup with code ${code}`)));
    api.stdout?.on("data", (chunk) => {
      if (String(chunk).includes("FocusPath API listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
});

afterAll(async () => {
  if (!api?.killed) api.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    if (api.exitCode !== null) resolve();
    else api.once("exit", () => resolve());
  });
});

describe("HTTP API", () => {
  it("reports readiness without exposing cacheable data", async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok", activeScans: 0 });
  });

  it("enforces JSON content type", async () => {
    const response = await fetch(`${baseUrl}/v1/scans`, { method: "POST", body: "url=https://example.com" });
    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({ error: "Content-Type must be application/json." });
  });

  it("rejects malformed and unexpected request bodies", async () => {
    const malformed = await fetch(`${baseUrl}/v1/scans`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect(malformed.status).toBe(400);

    const extra = await fetch(`${baseUrl}/v1/scans`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com", extra: true }),
    });
    expect(extra.status).toBe(400);
    expect(await extra.json()).toEqual({ error: "Request body must contain only a URL." });
  });

  it("rejects unsafe targets over the real HTTP boundary", async () => {
    const response = await fetch(`${baseUrl}/v1/scans`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "http://127.0.0.1" }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "The URL does not resolve to a public internet address." });
  });
});

async function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate API test port"));
        return;
      }
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

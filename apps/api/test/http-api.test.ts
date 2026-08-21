import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let api: ChildProcess;
let baseUrl: string;

beforeAll(async () => {
  ({ process: api, baseUrl } = await startApi());
});

afterAll(async () => {
  await stopApi(api);
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

  it("applies CORS only to allowed browser origins", async () => {
    const allowed = await fetch(`${baseUrl}/v1/scans`, {
      method: "OPTIONS",
      headers: { origin: "http://127.0.0.1:5173" },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5173");
    expect(allowed.headers.get("access-control-allow-methods")).toContain("POST");

    const denied = await fetch(`${baseUrl}/v1/scans`, {
      method: "OPTIONS",
      headers: { origin: "https://attacker.example" },
    });
    expect(denied.status).toBe(403);
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("hides scan routes unless the private origin token is present", async () => {
    const isolated = await startApi({ ORIGIN_VERIFY_TOKEN: "test-origin-secret" });
    try {
      const missing = await postScan(isolated.baseUrl, "http://127.0.0.1");
      expect(missing.status).toBe(404);

      const accepted = await postScan(isolated.baseUrl, "http://127.0.0.1", {
        "x-focuspath-origin-verify": "test-origin-secret",
      });
      expect(accepted.status).toBe(400);
    } finally {
      await stopApi(isolated.process);
    }
  });

  it("maps client quotas and scanner capacity to retryable responses", async () => {
    const rateLimited = await startApi({ RATE_LIMIT_PER_10_MINUTES: "0" });
    const atCapacity = await startApi({ MAX_CONCURRENT_SCANS: "0" });
    try {
      const quota = await postScan(rateLimited.baseUrl, "https://example.com");
      expect(quota.status).toBe(429);
      expect(quota.headers.get("retry-after")).toBe("600");

      const capacity = await postScan(atCapacity.baseUrl, "https://example.com");
      expect(capacity.status).toBe(503);
      expect(capacity.headers.get("retry-after")).toBe("15");
    } finally {
      await Promise.all([stopApi(rateLimited.process), stopApi(atCapacity.process)]);
    }
  });

  it("maps a scanner deadline to HTTP 504", async () => {
    const isolated = await startApi({ SCAN_TIMEOUT_MS: "1" });
    try {
      const response = await postScan(isolated.baseUrl, "https://example.com");
      expect(response.status).toBe(504);
      expect(await response.json()).toEqual({ error: "The scan reached its time limit. Try a smaller or faster page." });
    } finally {
      await stopApi(isolated.process);
    }
  });
});

async function postScan(url: string, target: string, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${url}/v1/scans`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ url: target }),
  });
}

async function startApi(env: Record<string, string> = {}): Promise<{ process: ChildProcess; baseUrl: string }> {
  const port = await availablePort();
  const child = spawn(process.execPath, [fileURLToPath(new URL("../../../node_modules/tsx/dist/cli.mjs", import.meta.url)), "src/server.ts"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    env: {
      ...process.env,
      PORT: String(port),
      ORIGIN_VERIFY_TOKEN: "",
      ALLOWED_ORIGINS: "http://127.0.0.1:5173",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("API did not start in time")), 5_000);
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`API exited before startup with code ${code}`)));
    child.stdout?.on("data", (chunk) => {
      if (String(chunk).includes("FocusPath API listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  return { process: child, baseUrl: `http://127.0.0.1:${port}` };
}

async function stopApi(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  if (await waitForExit(child, 1_000)) return;
  child.kill("SIGKILL");
  await waitForExit(child, 1_000);
}

async function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null) return true;
  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    const timeout = setTimeout(() => {
      child.off("exit", onExit);
      resolve(false);
    }, timeoutMs);
    child.once("exit", onExit);
  });
}

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

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { generateHtmlReport, scanFocusPath } from "focuspath";
import { assertPublicUrl, createPublicUrlPolicy, UnsafeUrlError } from "./network-policy.js";

const port = Number(process.env.PORT ?? 8787);
const maxConcurrentScans = Number(process.env.MAX_CONCURRENT_SCANS ?? 2);
const maxSteps = Number(process.env.MAX_FOCUS_STEPS ?? 50);
const scanTimeoutMs = Number(process.env.SCAN_TIMEOUT_MS ?? 25_000);
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173,https://damianociarla.github.io").split(",").map((origin) => origin.trim()).filter(Boolean));
const rateWindowMs = 10 * 60_000;
const rateMax = Number(process.env.RATE_LIMIT_PER_10_MINUTES ?? 4);
const rateBuckets = new Map<string, number[]>();
let activeScans = 0;

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("vary", "Origin");
    response.setHeader("access-control-allow-headers", "content-type");
    response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  }

  if (request.method === "OPTIONS") {
    response.writeHead(origin && allowedOrigins.has(origin) ? 204 : 403).end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    json(response, 200, { status: "ok", activeScans });
    return;
  }

  if (request.method !== "POST" || request.url !== "/v1/scans") {
    json(response, 404, { error: "Not found" });
    return;
  }

  if (origin && !allowedOrigins.has(origin)) {
    json(response, 403, { error: "Origin not allowed" });
    return;
  }

  const client = clientAddress(request);
  if (!consumeRateLimit(client)) {
    response.setHeader("retry-after", "600");
    json(response, 429, { error: "Scan limit reached. Try again in a few minutes." });
    return;
  }

  if (activeScans >= maxConcurrentScans) {
    response.setHeader("retry-after", "15");
    json(response, 503, { error: "All scanners are busy. Try again shortly." });
    return;
  }

  let acquiredScanSlot = false;
  try {
    const body = await readJsonBody(request);
    const submitted = typeof body.url === "string" ? body.url.trim() : "";
    const url = await assertPublicUrl(submitted);
    activeScans += 1;
    acquiredScanSlot = true;

    const report = await scanFocusPath(url.toString(), {
      headless: true,
      maxSteps,
      timeoutMs: scanTimeoutMs,
      viewport: { width: 1280, height: 800 },
      isUrlAllowed: createPublicUrlPolicy(),
    });

    json(response, 200, {
      url: report.url,
      title: report.title,
      scannedAt: report.scannedAt,
      durationMs: report.durationMs,
      stoppedBecause: report.stoppedBecause,
      steps: report.steps,
      issues: report.issues,
      reportHtml: generateHtmlReport(report),
    });
  } catch (error) {
    if (error instanceof UnsafeUrlError) json(response, 400, { error: error.message });
    else if (error instanceof SyntaxError) json(response, 400, { error: "Invalid JSON request." });
    else {
      console.error(error);
      json(response, 502, { error: "The page could not be scanned. It may block automated browsers or take too long to load." });
    }
  } finally {
    if (acquiredScanSlot) activeScans = Math.max(0, activeScans - 1);
  }
});

server.listen(port, "0.0.0.0", () => console.log(`FocusPath API listening on :${port}`));

function json(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  }).end(payload);
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 4096) throw new SyntaxError("Request body too large.");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function clientAddress(request: IncomingMessage): string {
  const forwarded = request.headers["x-forwarded-for"];
  return (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0])?.trim() || request.socket.remoteAddress || "unknown";
}

function consumeRateLimit(client: string): boolean {
  const now = Date.now();
  const recent = (rateBuckets.get(client) ?? []).filter((timestamp) => now - timestamp < rateWindowMs);
  if (recent.length >= rateMax) return false;
  recent.push(now);
  rateBuckets.set(client, recent);
  if (rateBuckets.size > 10_000) rateBuckets.clear();
  return true;
}

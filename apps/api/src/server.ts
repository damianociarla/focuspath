import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { generateHtmlReport, ScanTimeoutError, scanFocusPath } from "focuspath";
import { assertPublicUrl, createPublicUrlPolicy, parseHttpUrl, UnsafeUrlError } from "./network-policy.js";
import { clientAddress, consumeRateLimits, hasValidOriginToken, SlidingWindowLimiter } from "./security.js";

const port = Number(process.env.PORT ?? 8787);
const maxConcurrentScans = Number(process.env.MAX_CONCURRENT_SCANS ?? 2);
const maxSteps = Number(process.env.MAX_FOCUS_STEPS ?? 50);
const maxTabPresses = Number(process.env.MAX_TAB_PRESSES ?? maxSteps * 4);
const maxOpaqueTabPresses = Number(process.env.MAX_OPAQUE_TAB_PRESSES ?? 100);
const scanTimeoutMs = Number(process.env.SCAN_TIMEOUT_MS ?? 25_000);
const engineVersion = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;
const originVerifyToken = process.env.ORIGIN_VERIFY_TOKEN ?? "";
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173,https://damianociarla.github.io").split(",").map((origin) => origin.trim()).filter(Boolean));
const rateWindowMs = 10 * 60_000;
const rateMax = Number(process.env.RATE_LIMIT_PER_10_MINUTES ?? 4);
const globalRateMax = Number(process.env.GLOBAL_RATE_LIMIT_PER_HOUR ?? 60);
const targetRateMax = Number(process.env.TARGET_RATE_LIMIT_PER_HOUR ?? 2);
const clientLimiter = new SlidingWindowLimiter(rateMax, rateWindowMs);
const globalLimiter = new SlidingWindowLimiter(globalRateMax, 60 * 60_000, 1);
const targetLimiter = new SlidingWindowLimiter(targetRateMax, 60 * 60_000);
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
    json(response, 200, { status: "ok", version: engineVersion, activeScans });
    return;
  }

  if (request.method !== "POST" || request.url !== "/v1/scans") {
    json(response, 404, { error: "Not found" });
    return;
  }

  if (!hasValidOriginToken(originVerifyToken, request.headers["x-focuspath-origin-verify"])) {
    json(response, 404, { error: "Not found" });
    return;
  }

  if (origin && !allowedOrigins.has(origin)) {
    json(response, 403, { error: "Origin not allowed" });
    return;
  }


  if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
    json(response, 415, { error: "Content-Type must be application/json." });
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
    if (Object.keys(body).some((key) => key !== "url")) throw new UnsafeUrlError("Request body must contain only a URL.");
    const submitted = typeof body.url === "string" ? body.url.trim() : "";
    if (submitted.length > 2_048) throw new UnsafeUrlError("The URL must be at most 2048 characters.");
    parseHttpUrl(submitted);

    const client = clientAddress(request);
    const url = await assertPublicUrl(submitted);
    const rejectedLimit = consumeRateLimits([
      { limiter: clientLimiter, key: client },
      { limiter: globalLimiter, key: "all" },
      { limiter: targetLimiter, key: url.hostname },
    ]);
    if (rejectedLimit !== null) {
      const rejected = [
        { retryAfter: "600", error: "Scan limit reached. Try again in a few minutes." },
        { retryAfter: "3600", error: "The public demo has reached its hourly capacity. Try again later." },
        { retryAfter: "3600", error: "This hostname was already scanned recently. Try again later." },
      ][rejectedLimit]!;
      response.setHeader("retry-after", rejected.retryAfter);
      json(response, 429, { error: rejected.error });
      return;
    }

    activeScans += 1;
    acquiredScanSlot = true;

    const report = await scanFocusPath(url.toString(), {
      headless: true,
      direction: "forward",
      maxSteps,
      maxTabPresses,
      maxOpaqueTabPresses,
      timeoutMs: scanTimeoutMs,
      viewport: { width: 1280, height: 800 },
      isUrlAllowed: createPublicUrlPolicy(),
      maxRequests: 120,
      blockedResourceTypes: ["font", "media"],
      maxScreenshotHeight: 5_000,
    });

    json(response, 200, {
      url: report.url,
      title: report.title,
      scannedAt: report.scannedAt,
      durationMs: report.durationMs,
      engineVersion,
      direction: report.direction,
      tabPressCount: report.tabPressCount,
      limits: report.limits,
      stoppedBecause: report.stoppedBecause,
      steps: report.steps,
      issues: report.issues,
      reportHtml: generateHtmlReport(report),
    });
  } catch (error) {
    if (error instanceof UnsafeUrlError) json(response, 400, { error: error.message });
    else if (error instanceof SyntaxError) json(response, 400, { error: "Invalid JSON request." });
    else if (error instanceof ScanTimeoutError) json(response, 504, { error: "The scan reached its time limit. Try a smaller or faster page." });
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

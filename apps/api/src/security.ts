import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

export class SlidingWindowLimiter {
  private readonly buckets = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxBuckets = 10_000,
  ) {}

  consume(key: string, now = Date.now()): boolean {
    const recent = (this.buckets.get(key) ?? []).filter((timestamp) => now - timestamp < this.windowMs);
    if (recent.length >= this.limit) {
      this.buckets.set(key, recent);
      return false;
    }

    recent.push(now);
    this.buckets.set(key, recent);
    if (this.buckets.size > this.maxBuckets) this.buckets.clear();
    return true;
  }
}

export function hasValidOriginToken(expected: string, provided: string | string[] | undefined): boolean {
  if (!expected) return true;
  if (typeof provided !== "string") return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

export function clientAddress(request: IncomingMessage): string {
  const cloudFrontAddress = firstHeaderValue(request.headers["cloudfront-viewer-address"]);
  if (cloudFrontAddress) return stripPort(cloudFrontAddress);

  const forwarded = firstHeaderValue(request.headers["x-forwarded-for"]);
  return forwarded?.split(",")[0]?.trim() || request.socket.remoteAddress || "unknown";
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function stripPort(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) return trimmed.slice(1, trimmed.indexOf("]"));
  return trimmed.replace(/:\d+$/, "");
}

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
    if (!this.canConsume(key, now)) return false;
    this.commit(key, now);
    return true;
  }

  canConsume(key: string, now = Date.now()): boolean {
    const recent = this.recent(key, now);
    return recent.length < this.limit;
  }

  commit(key: string, now = Date.now()): void {
    const recent = this.recent(key, now);
    recent.push(now);
    this.buckets.set(key, recent);
    if (this.buckets.size > this.maxBuckets) this.buckets.clear();
  }

  usage(key: string, now = Date.now()): number {
    return this.recent(key, now).length;
  }

  private recent(key: string, now: number): number[] {
    return (this.buckets.get(key) ?? []).filter((timestamp) => now - timestamp < this.windowMs);
  }
}

export interface RateLimitRequest {
  limiter: SlidingWindowLimiter;
  key: string;
}

/**
 * Checks every in-process quota before committing any of them. JavaScript runs
 * this synchronous block without interleaving requests, so a rejected quota
 * cannot consume capacity from an earlier limiter.
 */
export function consumeRateLimits(requests: RateLimitRequest[], now = Date.now()): number | null {
  const rejectedIndex = requests.findIndex(({ limiter, key }) => !limiter.canConsume(key, now));
  if (rejectedIndex >= 0) return rejectedIndex;
  for (const { limiter, key } of requests) limiter.commit(key, now);
  return null;
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

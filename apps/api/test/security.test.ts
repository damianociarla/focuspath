import { describe, expect, it } from "vitest";
import { consumeRateLimits, hasValidOriginToken, SlidingWindowLimiter } from "../src/security.js";

describe("API security", () => {
  it("requires the exact configured origin token", () => {
    expect(hasValidOriginToken("secret", "secret")).toBe(true);
    expect(hasValidOriginToken("secret", "wrong!")).toBe(false);
    expect(hasValidOriginToken("secret", undefined)).toBe(false);
  });

  it("keeps local development tokenless", () => {
    expect(hasValidOriginToken("", undefined)).toBe(true);
  });

  it("enforces a sliding-window limit", () => {
    const limiter = new SlidingWindowLimiter(2, 1_000);
    expect(limiter.consume("client", 0)).toBe(true);
    expect(limiter.consume("client", 100)).toBe(true);
    expect(limiter.consume("client", 999)).toBe(false);
    expect(limiter.consume("client", 1_001)).toBe(true);
  });

  it("does not consume any quota when a later limiter rejects the request", () => {
    const client = new SlidingWindowLimiter(2, 1_000);
    const global = new SlidingWindowLimiter(2, 1_000);
    const target = new SlidingWindowLimiter(1, 1_000);
    expect(target.consume("example.com", 0)).toBe(true);

    expect(consumeRateLimits([
      { limiter: client, key: "client" },
      { limiter: global, key: "all" },
      { limiter: target, key: "example.com" },
    ], 100)).toBe(2);
    expect(client.usage("client", 100)).toBe(0);
    expect(global.usage("all", 100)).toBe(0);
    expect(target.usage("example.com", 100)).toBe(1);
  });

  it("commits all quotas together when every limiter accepts", () => {
    const client = new SlidingWindowLimiter(2, 1_000);
    const global = new SlidingWindowLimiter(2, 1_000);
    const target = new SlidingWindowLimiter(2, 1_000);

    expect(consumeRateLimits([
      { limiter: client, key: "client" },
      { limiter: global, key: "all" },
      { limiter: target, key: "example.com" },
    ], 100)).toBeNull();
    expect([client.usage("client", 100), global.usage("all", 100), target.usage("example.com", 100)]).toEqual([1, 1, 1]);
  });
});

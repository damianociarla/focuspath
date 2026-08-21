import { describe, expect, it } from "vitest";
import { hasValidOriginToken, SlidingWindowLimiter } from "../src/security.js";

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
});

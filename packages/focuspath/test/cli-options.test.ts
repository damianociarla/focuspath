import { describe, expect, it } from "vitest";
import { parseCliOptions } from "../src/cli-options.js";

describe("CLI options", () => {
  it("does not mistake an option value for the URL", () => {
    const parsed = parseCliOptions(["--output", "/tmp/report.html", "example.com"]);
    expect(parsed.url).toBe("http://example.com/");
    expect(parsed.output).toBe("/tmp/report.html");
  });

  it("supports options after the URL", () => {
    const parsed = parseCliOptions(["https://example.com", "--max-steps", "20", "--max-tab-presses", "120", "--max-opaque-tab-presses", "80", "--max-requests", "240", "--max-screenshot-height", "12000", "--direction", "reverse", "--viewport", "390x844"]);
    expect(parsed.maxSteps).toBe(20);
    expect(parsed.maxTabPresses).toBe(120);
    expect(parsed.maxOpaqueTabPresses).toBe(80);
    expect(parsed.maxRequests).toBe(240);
    expect(parsed.maxScreenshotHeight).toBe(12_000);
    expect(parsed.direction).toBe("reverse");
    expect(parsed.viewport).toEqual({ width: 390, height: 844 });
  });

  it("rejects unknown and extra arguments", () => {
    expect(() => parseCliOptions(["--wat", "example.com"])).toThrow(/Unknown option/);
    expect(() => parseCliOptions(["one.example", "two.example"])).toThrow(/Unexpected argument/);
  });

  it("rejects an explicit non-HTTP protocol", () => {
    expect(() => parseCliOptions(["ftp://example.com"])).toThrow(/Only http and https/);
  });

  it("derives a total Tab budget from the observed step limit", () => {
    const parsed = parseCliOptions(["example.com", "--max-steps", "30"]);
    expect(parsed.maxTabPresses).toBe(120);
    expect(parsed.direction).toBe("forward");
    expect(parsed.maxRequests).toBe(500);
    expect(parsed.maxScreenshotHeight).toBe(20_000);
  });

  it("requires an explicit unlimited profile", () => {
    const parsed = parseCliOptions(["example.com", "--unlimited"]);
    expect(parsed.maxRequests).toBe(Number.POSITIVE_INFINITY);
    expect(parsed.maxScreenshotHeight).toBe(Number.POSITIVE_INFINITY);
    expect(() => parseCliOptions(["example.com", "--unlimited", "--max-requests", "10"])).toThrow(/cannot be combined/);
  });

  it("rejects invalid traversal budgets", () => {
    expect(() => parseCliOptions(["example.com", "--max-tab-presses", "0"])).toThrow(/max-tab-presses/);
    expect(() => parseCliOptions(["example.com", "--max-opaque-tab-presses", "nope"])).toThrow(/max-opaque-tab-presses/);
    expect(() => parseCliOptions(["example.com", "--direction", "sideways"])).toThrow(/direction/);
    expect(() => parseCliOptions(["example.com", "--max-requests", "0"])).toThrow(/max-requests/);
    expect(() => parseCliOptions(["example.com", "--max-screenshot-height", "100001"])).toThrow(/max-screenshot-height/);
  });
});

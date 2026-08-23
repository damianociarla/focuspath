import { describe, expect, it } from "vitest";
import { parseCliOptions } from "../src/cli-options.js";

describe("CLI options", () => {
  it("does not mistake an option value for the URL", () => {
    const parsed = parseCliOptions(["--output", "/tmp/report.html", "example.com"]);
    expect(parsed.url).toBe("https://example.com/");
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

  it("supports short and long version flags without requiring a URL", () => {
    expect(parseCliOptions(["--version"]).version).toBe(true);
    expect(parseCliOptions(["-V"]).version).toBe(true);
  });

  it("rejects unknown and extra arguments", () => {
    expect(() => parseCliOptions(["--wat", "example.com"])).toThrow(/Unknown option/);
    expect(() => parseCliOptions(["one.example", "two.example"])).toThrow(/Unexpected argument/);
  });

  it("rejects an explicit non-HTTP protocol", () => {
    expect(() => parseCliOptions(["ftp://example.com"])).toThrow(/Only http and https/);
  });

  it("defaults public hosts to HTTPS and local hosts to HTTP", () => {
    expect(parseCliOptions(["example.com"]).url).toBe("https://example.com/");
    expect(parseCliOptions(["localhost:3000"]).url).toBe("http://localhost:3000/");
    expect(parseCliOptions(["127.0.0.1:4173"]).url).toBe("http://127.0.0.1:4173/");
    expect(parseCliOptions(["[::1]:8080"]).url).toBe("http://[::1]:8080/");
    expect(parseCliOptions(["https://localhost:3000"]).url).toBe("https://localhost:3000/");
  });

  it("rejects embedded URL credentials without echoing them", () => {
    expect(() => parseCliOptions(["https://user:secret@example.com"])).toThrow("URLs containing embedded credentials are not supported.");
    try {
      parseCliOptions(["https://user:secret@example.com"]);
    } catch (error) {
      expect(String(error)).not.toContain("secret");
    }
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

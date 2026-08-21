import { describe, expect, it } from "vitest";
import { parseCliOptions } from "../src/cli-options.js";

describe("CLI options", () => {
  it("does not mistake an option value for the URL", () => {
    const parsed = parseCliOptions(["--output", "/tmp/report.html", "example.com"]);
    expect(parsed.url).toBe("http://example.com/");
    expect(parsed.output).toBe("/tmp/report.html");
  });

  it("supports options after the URL", () => {
    const parsed = parseCliOptions(["https://example.com", "--max-steps", "20", "--viewport", "390x844"]);
    expect(parsed.maxSteps).toBe(20);
    expect(parsed.viewport).toEqual({ width: 390, height: 844 });
  });

  it("rejects unknown and extra arguments", () => {
    expect(() => parseCliOptions(["--wat", "example.com"])).toThrow(/Unknown option/);
    expect(() => parseCliOptions(["one.example", "two.example"])).toThrow(/Unexpected argument/);
  });

  it("rejects an explicit non-HTTP protocol", () => {
    expect(() => parseCliOptions(["ftp://example.com"])).toThrow(/Only http and https/);
  });
});

import { describe, expect, it } from "vitest";
import { MAX_REPORT_PIXELS, maxReportHeight } from "../src/report-limits.js";

describe("shared report pixel budget", () => {
  it("derives a safe capture height from the actual capture width", () => {
    expect(MAX_REPORT_PIXELS).toBe(40_000_000);
    expect(maxReportHeight(1_440)).toBe(27_777);
    expect(maxReportHeight(4_000)).toBe(10_000);
    expect(() => maxReportHeight(0)).toThrow(/captureWidth/);
  });
});

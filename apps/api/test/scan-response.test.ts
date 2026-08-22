import { describe, expect, it } from "vitest";
import type { FocusReport } from "focuspath";
import { buildScanResponse } from "../src/scan-response.js";

const report: FocusReport = {
  version: 3,
  direction: "forward",
  url: "https://example.com/",
  title: "Example",
  scannedAt: "2026-08-22T00:00:00.000Z",
  durationMs: 120,
  tabPressCount: 2,
  limits: { maxSteps: 50, maxTabPresses: 200, maxOpaqueTabPresses: 100 },
  viewport: { width: 1280, height: 800 },
  document: { width: 1280, height: 800 },
  network: { requestCount: 8, blockedRequestCount: 2, blockedResourceTypes: ["font", "media"] },
  steps: [],
  issues: [],
  screenshot: "data:image/jpeg;base64,test",
  stoppedBecause: "document-exhausted",
};

describe("scan response formats", () => {
  it("keeps the default portable HTML response without duplicating the screenshot", () => {
    const response = buildScanResponse(report, "0.5.1", "html");
    expect(response).toMatchObject({
      reportVersion: 3,
      responseFormat: "html",
      viewport: { width: 1280, height: 800 },
      capture: { width: 1280, height: 800 },
      network: { requestCount: 8, blockedRequestCount: 2, blockedResourceTypes: ["font", "media"] },
    });
    expect(response.reportHtml).toContain("report schema v3");
    expect(response).not.toHaveProperty("screenshot");
  });

  it("returns screenshot pixels directly for structured consumers", () => {
    const response = buildScanResponse(report, "0.5.1", "structured");
    expect(response).toMatchObject({
      reportVersion: 3,
      responseFormat: "structured",
      screenshot: "data:image/jpeg;base64,test",
    });
    expect(response).not.toHaveProperty("reportHtml");
  });
});

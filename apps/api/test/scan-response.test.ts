import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import type { FocusReport } from "focuspath";
import { buildScanResponse } from "../src/scan-response.js";

function pngDataUrl(width: number, height: number): string {
  const signature = Buffer.from("89504e470d0a1a0a", "hex");
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  const chunk = (type: string, data: Buffer) => {
    const name = Buffer.from(type, "ascii");
    const output = Buffer.alloc(12 + data.length);
    output.writeUInt32BE(data.length, 0);
    name.copy(output, 4);
    data.copy(output, 8);
    output.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
    return output;
  };
  return `data:image/png;base64,${Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.alloc((width + 1) * height))), chunk("IEND", Buffer.alloc(0))]).toString("base64")}`;
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const screenshot = pngDataUrl(1280, 800);

const report: FocusReport = {
  version: 4,
  direction: "forward",
  url: "https://example.com/",
  title: "Example",
  scannedAt: "2026-08-22T00:00:00.000Z",
  durationMs: 120,
  tabPressCount: 2,
  limits: { maxSteps: 50, maxTabPresses: 200, maxOpaqueTabPresses: 100 },
  viewport: { width: 1280, height: 800 },
  document: { width: 1280, height: 800 },
  capture: { sourceWidth: 1280, sourceHeight: 1600, truncated: true },
  network: { requestCount: 8, blockedRequestCount: 2, blockedResourceTypes: ["font", "media"] },
  steps: [],
  issues: [],
  screenshot,
  stoppedBecause: "document-exhausted",
};

describe("scan response formats", () => {
  it("keeps the default portable HTML response without duplicating the screenshot", () => {
    const response = buildScanResponse(report, "0.6.6", "html");
    expect(response).toMatchObject({
      reportVersion: 4,
      responseFormat: "html",
      viewport: { width: 1280, height: 800 },
      capture: { width: 1280, height: 800, sourceWidth: 1280, sourceHeight: 1600, truncated: true },
      network: { requestCount: 8, blockedRequestCount: 2, blockedResourceTypes: ["font", "media"] },
    });
    expect(response.reportHtml).toContain("report schema v4");
    expect(response).not.toHaveProperty("screenshot");
  });

  it("returns screenshot pixels directly for structured consumers", () => {
    const response = buildScanResponse(report, "0.6.6", "structured");
    expect(response).toMatchObject({
      reportVersion: 4,
      responseFormat: "structured",
      screenshot,
    });
    expect(response).not.toHaveProperty("reportHtml");
  });
});

import assert from "node:assert/strict";
import { encode as encodeJpeg } from "jpeg-js";
import { generateHtmlReport } from "../packages/focuspath/dist/reporter.js";

const width = 32;
const height = 24;
const pixels = Buffer.alloc(width * height * 4);
for (let index = 0; index < pixels.length; index += 4) {
  pixels[index] = 20;
  pixels[index + 1] = 216;
  pixels[index + 2] = 178;
  pixels[index + 3] = 255;
}
const jpeg = encodeJpeg({ data: pixels, width, height }, 80).data;
const report = {
  version: 4,
  direction: "forward",
  url: "https://example.com/native-smoke",
  title: `Native reporter smoke on ${process.platform}/${process.arch}`,
  scannedAt: "2026-08-24T00:00:00.000Z",
  durationMs: 1,
  tabPressCount: 0,
  limits: { maxSteps: 1, maxTabPresses: 1, maxOpaqueTabPresses: 1 },
  viewport: { width, height },
  document: { width, height },
  capture: { sourceWidth: width, sourceHeight: height, truncated: false },
  network: { requestCount: 0, blockedRequestCount: 0, blockedResourceTypes: [] },
  screenshot: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
  stoppedBecause: "no-focusable-elements",
  steps: [],
  issues: [],
};

const html = generateHtmlReport(report);
assert.match(html, /FocusPath \/ Report/);
assert.match(html, new RegExp(`${process.platform}/${process.arch}`));
console.log(`Native JPEG reporter smoke passed on ${process.platform}/${process.arch}.`);

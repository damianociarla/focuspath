import { readFileSync } from "node:fs";
import { generateHtmlReport } from "../packages/focuspath/dist/reporter.js";
import { MAX_REPORT_PIXELS } from "../packages/focuspath/dist/report-limits.js";

const screenshot = readFileSync(process.argv[2]).toString("base64");
const width = 1_440;
const height = Math.floor(MAX_REPORT_PIXELS / width);
const report = {
  version: 4,
  direction: "forward",
  url: "https://example.com/tall",
  title: "Tall page memory fixture",
  scannedAt: "2026-08-24T00:00:00.000Z",
  durationMs: 1,
  tabPressCount: 0,
  limits: { maxSteps: 50, maxTabPresses: 200, maxOpaqueTabPresses: 100 },
  viewport: { width, height: 900 },
  document: { width, height },
  capture: { sourceWidth: width, sourceHeight: height, truncated: false },
  network: { requestCount: 1, blockedRequestCount: 0, blockedResourceTypes: [] },
  screenshot: `data:image/jpeg;base64,${screenshot}`,
  stoppedBecause: "no-focusable-elements",
  steps: [],
  issues: [],
};

const startedAt = performance.now();
const html = generateHtmlReport(report);
if (!html.includes("Tall page memory fixture")) throw new Error("Reporter did not render the benchmark fixture.");

console.log(JSON.stringify({
  durationMs: Math.round(performance.now() - startedAt),
  maxRssKiB: process.resourceUsage().maxRSS,
}));

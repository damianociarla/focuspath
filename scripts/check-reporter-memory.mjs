import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { MAX_REPORT_PIXELS } from "../packages/focuspath/dist/report-limits.js";

const width = 1_440;
const height = Math.floor(MAX_REPORT_PIXELS / width);
const baseline = JSON.parse(readFileSync(new URL("../benchmarks/reporter-baseline.json", import.meta.url), "utf8"));
assert.deepEqual(baseline.fixture, { width, height }, "Performance baseline must describe the current near-limit fixture.");
const directory = mkdtempSync(join(tmpdir(), "focuspath-reporter-memory-"));
const screenshotPath = join(directory, "tall-page.jpg");

try {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.setContent(`<style>html,body{margin:0}.tall{height:${height}px;background:linear-gradient(#102030,#dcefff)}</style><div class="tall"></div>`);
    await page.screenshot({ path: screenshotPath, type: "jpeg", quality: 72, fullPage: true });
  } finally {
    await browser.close();
  }

  assert(readFileSync(screenshotPath).length > 0, "Memory fixture screenshot is empty.");
  const output = execFileSync(process.execPath, [fileURLToPath(new URL("./measure-reporter-memory.mjs", import.meta.url)), screenshotPath], {
    encoding: "utf8",
  });
  const measurement = JSON.parse(output);
  const measuredMiB = measurement.maxRssKiB / 1024;
  const rssRegressionPercent = percentChange(measuredMiB, baseline.baseline.maxRssMiB);
  const durationRegressionPercent = percentChange(measurement.durationMs, baseline.baseline.durationMs);
  assert(measuredMiB <= baseline.budgets.absoluteMaxRssMiB, `Reporter used ${measuredMiB.toFixed(1)} MiB RSS, above the ${baseline.budgets.absoluteMaxRssMiB} MiB hard budget.`);
  assert(rssRegressionPercent <= baseline.budgets.maxRssRegressionPercent, `Reporter RSS regressed ${rssRegressionPercent.toFixed(1)}% from the ${baseline.baselineVersion} baseline.`);
  assert(durationRegressionPercent <= baseline.budgets.maxDurationRegressionPercent, `Reporter duration regressed ${durationRegressionPercent.toFixed(1)}% from the ${baseline.baselineVersion} baseline.`);

  const result = {
    schemaVersion: 1,
    commit: process.env.GITHUB_SHA ?? null,
    platform: `${process.platform}/${process.arch}`,
    fixture: { width, height },
    measured: { maxRssMiB: Number(measuredMiB.toFixed(1)), durationMs: measurement.durationMs },
    baseline: { version: baseline.baselineVersion, ...baseline.baseline },
    changePercent: { maxRss: Number(rssRegressionPercent.toFixed(1)), duration: Number(durationRegressionPercent.toFixed(1)) },
  };
  if (process.env.REPORTER_METRICS_PATH) writeFileSync(process.env.REPORTER_METRICS_PATH, `${JSON.stringify(result, null, 2)}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Reporter performance\n\n| Metric | Current | ${baseline.baselineVersion} baseline | Change |\n|---|---:|---:|---:|\n| Peak RSS | ${measuredMiB.toFixed(1)} MiB | ${baseline.baseline.maxRssMiB} MiB | ${signed(rssRegressionPercent)} |\n| Duration | ${measurement.durationMs} ms | ${baseline.baseline.durationMs} ms | ${signed(durationRegressionPercent)} |\n\n`);
  console.log(`Reporter performance check passed: ${width}x${height}, ${measuredMiB.toFixed(1)} MiB peak RSS (${signed(rssRegressionPercent)}), ${measurement.durationMs} ms (${signed(durationRegressionPercent)}).`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}

function percentChange(current, previous) {
  return ((current - previous) / previous) * 100;
}

function signed(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

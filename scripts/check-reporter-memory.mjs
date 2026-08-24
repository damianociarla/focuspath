import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { MAX_REPORT_PIXELS } from "../packages/focuspath/dist/report-limits.js";

const width = 1_440;
const height = Math.floor(MAX_REPORT_PIXELS / width);
const maxRssMiB = 384;
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
  assert(measuredMiB <= maxRssMiB, `Reporter used ${measuredMiB.toFixed(1)} MiB RSS, above the ${maxRssMiB} MiB budget.`);
  console.log(`Reporter memory check passed: ${width}x${height}, ${measuredMiB.toFixed(1)} MiB peak RSS, ${measurement.durationMs} ms.`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}

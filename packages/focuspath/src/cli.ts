#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { parseCliOptions } from "./cli-options.js";
import { generateHtmlReport } from "./reporter.js";
import { scanFocusPath } from "./scanner.js";

const HELP = `FocusPath — see where keyboard navigation breaks

Usage:
  focuspath <url> [options]

Options:
  -o, --output <file>      HTML report path (default: focuspath-report.html)
  --max-steps <number>     Maximum observed focus stops (default: 50)
  --max-tab-presses <n>    Maximum total Tab presses (default: 4 × max-steps)
  --max-opaque-tab-presses <n> Repeated Tab limit per opaque host (default: 100)
  --viewport <width>x<height> (default: 1440x900)
  --headed                 Show the browser while scanning
  -h, --help               Show this help
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(HELP);
    return;
  }

  const options = parseCliOptions(args);
  if (options.help) {
    console.log(HELP);
    return;
  }

  const output = resolve(options.output);
  console.log(`Scanning ${options.url}`);
  const report = await scanFocusPath(options.url, {
    maxSteps: options.maxSteps,
    maxTabPresses: options.maxTabPresses,
    maxOpaqueTabPresses: options.maxOpaqueTabPresses,
    viewport: options.viewport,
    headless: !options.headed,
  });
  await writeFile(output, generateHtmlReport(report), "utf8");
  const errors = report.issues.filter((issue) => issue.severity === "error").length;
  const warnings = report.issues.filter((issue) => issue.severity === "warning").length;
  console.log(`✓ ${report.steps.length} focus stops · ${report.tabPressCount} Tab presses · ${errors} errors · ${warnings} warnings`);
  console.log(`Report: ${output}`);
  if (errors > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(`FocusPath failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
});

#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { generateHtmlReport } from "./reporter.js";
import { scanFocusPath } from "./scanner.js";

const HELP = `FocusPath — see where keyboard navigation breaks

Usage:
  focuspath <url> [options]

Options:
  -o, --output <file>      HTML report path (default: focuspath-report.html)
  --max-steps <number>     Maximum Tab presses (default: 50)
  --viewport <width>x<height> (default: 1440x900)
  --headed                 Show the browser while scanning
  -h, --help               Show this help
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return;
  }

  const urlArg = args.find((arg) => !arg.startsWith("-"));
  if (!urlArg) throw new Error("Missing URL. Run focuspath --help for usage.");
  const url = normalizeUrl(urlArg);
  const output = resolve(readValue(args, "--output", "-o") ?? "focuspath-report.html");
  const maxSteps = Number(readValue(args, "--max-steps") ?? 50);
  const viewport = parseViewport(readValue(args, "--viewport") ?? "1440x900");

  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 500) throw new Error("--max-steps must be an integer between 1 and 500.");
  console.log(`Scanning ${url}`);
  const report = await scanFocusPath(url, { maxSteps, viewport, headless: !args.includes("--headed") });
  await writeFile(output, generateHtmlReport(report), "utf8");
  const errors = report.issues.filter((issue) => issue.severity === "error").length;
  const warnings = report.issues.filter((issue) => issue.severity === "warning").length;
  console.log(`✓ ${report.steps.length} focus stops · ${errors} errors · ${warnings} warnings`);
  console.log(`Report: ${output}`);
  if (errors > 0) process.exitCode = 1;
}

function readValue(args: string[], long: string, short?: string): string | undefined {
  const index = args.findIndex((arg) => arg === long || arg === short);
  return index >= 0 ? args[index + 1] : undefined;
}

function normalizeUrl(value: string): string {
  const candidate = /^https?:\/\//i.test(value) ? value : `http://${value}`;
  const parsed = new URL(candidate);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only http and https URLs are supported.");
  return parsed.toString();
}

function parseViewport(value: string): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/.exec(value);
  if (!match) throw new Error("--viewport must use the format 1440x900.");
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width < 320 || height < 320 || width > 4000 || height > 4000) throw new Error("Viewport dimensions must be between 320 and 4000.");
  return { width, height };
}

main().catch((error: unknown) => {
  console.error(`FocusPath failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
});

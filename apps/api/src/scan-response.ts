import { generateHtmlReport, type FocusReport } from "focuspath";

export type ScanResponseFormat = "html" | "structured";

export function buildScanResponse(report: FocusReport, engineVersion: string, format: ScanResponseFormat): Record<string, unknown> {
  const common = {
    reportVersion: report.version,
    engineVersion,
    responseFormat: format,
    url: report.url,
    title: report.title,
    scannedAt: report.scannedAt,
    durationMs: report.durationMs,
    direction: report.direction,
    tabPressCount: report.tabPressCount,
    limits: report.limits,
    viewport: report.viewport,
    capture: report.document,
    network: report.network,
    stoppedBecause: report.stoppedBecause,
    steps: report.steps,
    issues: report.issues,
  };
  return format === "structured"
    ? { ...common, screenshot: report.screenshot }
    : { ...common, reportHtml: generateHtmlReport(report) };
}

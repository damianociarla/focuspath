import { generateHtmlReport, scanFocusPath } from "focuspath";

export async function createFocusPathReport(url: string): Promise<string> {
  const report = await scanFocusPath(url, {
    maxSteps: 50,
    maxTabPresses: 200,
    maxOpaqueTabPresses: 100,
    direction: "reverse",
    timeoutMs: 30_000,
  });

  console.log(report.tabPressCount, report.limits);
  return generateHtmlReport(report);
}

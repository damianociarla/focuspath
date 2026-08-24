import { generateHtmlReport } from "focuspath/reporter";
import type { FocusReport } from "focuspath";

export function renderSavedReport(report: FocusReport): string {
  return generateHtmlReport(report);
}

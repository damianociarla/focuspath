/** Hard safety boundary shared by screenshot capture and saved-report rendering. */
export const MAX_REPORT_PIXELS = 40_000_000;

export function maxReportHeight(captureWidth: number): number {
  if (!Number.isSafeInteger(captureWidth) || captureWidth < 1) {
    throw new TypeError("captureWidth must be a positive safe integer.");
  }
  return Math.max(1, Math.floor(MAX_REPORT_PIXELS / captureWidth));
}

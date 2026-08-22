import type { FocusReport } from "./types.js";

export function generateHtmlReport(report: FocusReport): string {
  const errors = report.issues.filter((issue) => issue.severity === "error").length;
  const warnings = report.issues.filter((issue) => issue.severity === "warning").length;
  const path = report.steps
    .map((step, index) => {
      if (!isPlottable(step, report)) return "";
      const next = report.steps[index + 1];
      const [x1, y1] = evidencePoint(step, report);
      const line = next && isPlottable(next, report)
        ? (() => {
            const [x2, y2] = evidencePoint(next, report);
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
          })()
        : "";
      const shape = step.quad?.length === 8
        ? `<polygon points="${quadPoints(step.quad)}"/>`
        : `<rect x="${step.rect.x}" y="${step.rect.y}" width="${Math.max(step.rect.width, 20)}" height="${Math.max(step.rect.height, 20)}" rx="4"/>`;
      return `${line}<g class="focus-node">${shape}<circle cx="${x1}" cy="${y1}" r="13"/><text x="${x1}" y="${y1 + 4}">${step.index}</text></g>`;
    })
    .join("");

  const issueRows = report.issues.length
    ? report.issues.map((issue) => `<li class="issue ${issue.severity}"><span>${issue.severity}</span><strong>Step ${issue.step}</strong><code>${escapeHtml(issue.selector)}</code><p>${escapeHtml(issue.message)}</p></li>`).join("")
    : `<li class="empty">No automatically detectable focus-order issues found.</li>`;

  const stepRows = report.steps.map((step) => {
    const styles = step.focusIndicator.boxShadow === "none" ? step.focusIndicator.outline : `${step.focusIndicator.outline}; box-shadow: ${step.focusIndicator.boxShadow}`;
    const scrollContexts = scrollContextsFor(step);
    const evidenceStatus = visualEvidenceFor(step, report);
    const evidence = evidenceStatus === "sequence-only" && scrollContexts.length > 0
      ? `Sequence only — ${scrollContexts.map((context) => `${context.kind ?? "element"} ${context.selector} at scroll ${context.scrollLeft}, ${context.scrollTop}`).join("; ")}`
      : evidenceStatus === "sequence-only"
        ? "Sequence only — final geometry unavailable"
        : evidenceStatus === "outside-capture"
          ? "Outside captured screenshot"
          : evidenceStatus === "partially-visible"
            ? "Partially visible on final screenshot"
            : "Plotted on final screenshot";
    return `<tr><th scope="row">${step.index}</th><td><code>${escapeHtml(step.selector)}</code></td><td>${escapeHtml(step.role ?? step.tagName)}</td><td>${escapeHtml(step.accessibleName || "—")}</td><td>${escapeHtml(styles)}</td><td>${escapeHtml(evidence)}</td></tr>`;
  }).join("");
  const omittedOverlaySteps = report.steps.filter((step) => !isPlottable(step, report)).length;
  const partiallyVisibleSteps = report.steps.filter((step) => visualEvidenceFor(step, report) === "partially-visible").length;
  const visualNote = omittedOverlaySteps > 0
    ? `<p class="visual-note"><strong>${omittedOverlaySteps} ${omittedOverlaySteps === 1 ? "step is" : "steps are"} omitted from the overlay.</strong> Their final geometry is unavailable, crosses an independent scrolling or clipping context, or falls outside the captured pixels. Every step remains recorded in the table.${partiallyVisibleSteps > 0 ? ` ${partiallyVisibleSteps} additional ${partiallyVisibleSteps === 1 ? "step is" : "steps are"} only partially visible.` : ""}</p>`
    : partiallyVisibleSteps > 0
      ? `<p class="visual-note"><strong>${partiallyVisibleSteps} ${partiallyVisibleSteps === 1 ? "step is" : "steps are"} partially visible.</strong> The overlay is clipped to the pixels present in the final screenshot.</p>`
      : "";
  const networkNote = report.network && (report.network.blockedRequestCount > 0 || report.network.blockedResourceTypes.length > 0)
    ? `<p class="visual-note"><strong>Rendered with network restrictions.</strong> ${report.network.blockedRequestCount} ${report.network.blockedRequestCount === 1 ? "request was" : "requests were"} blocked. Configured blocked resource types: ${escapeHtml(report.network.blockedResourceTypes.join(", ") || "none")}. Geometry may differ from an unrestricted browser session.</p>`
    : "";
  const captureNote = report.capture?.truncated
    ? `<p class="visual-note"><strong>Screenshot capture was truncated.</strong> The report contains ${report.document.height}px of a ${report.capture.sourceHeight}px document because the configured screenshot-height budget was reached. Focus stops outside those pixels remain in the sequence table.</p>`
    : "";
  const reportTitle = escapeHtml(report.title || "Untitled page");
  const screenshot = escapeHtml(report.screenshot);
  const stopReason = {
    "cycle-complete": "returned to an earlier focus stop",
    "step-limit": "configured step limit reached",
    "tab-press-limit": "configured total Tab press limit reached",
    "opaque-host-limit": "configured opaque-host Tab press limit reached",
    "no-focusable-elements": "no focusable elements found",
    "document-exhausted": "end of document reached",
    "stalled-on-element": "focus remained on one element",
  }[report.stoppedBecause];

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>FocusPath — ${escapeHtml(report.title || report.url)}</title>
<style>
:root{color-scheme:dark;--bg:#0a0b0b;--panel:#121413;--ink:#f1f5ef;--muted:#929b94;--line:#2a302c;--green:#b6ff55;--red:#ff6b5d;--amber:#ffc857}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.skip-link{position:fixed;z-index:10;top:12px;left:12px;padding:11px 15px;background:var(--green);color:#0a0b0b;transform:translateY(-180%)}.skip-link:focus{transform:none;outline:3px solid #fff;outline-offset:3px}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}header,main{width:min(1180px,calc(100% - 40px));margin:auto}header{padding:48px 0 32px;border-bottom:1px solid var(--line)}.brand{color:var(--green);font-weight:800;letter-spacing:.12em;text-transform:uppercase}h1{font:700 clamp(34px,6vw,72px)/.98 ui-sans-serif,system-ui;margin:18px 0;max-width:900px;letter-spacing:-.055em}.url{color:var(--muted);overflow-wrap:anywhere}.summary{display:flex;gap:32px;padding:24px 0;margin:0}.metric dd{display:block;margin:0;font:700 30px/1 ui-sans-serif,system-ui}.metric dt{color:var(--muted);font-size:12px;text-transform:uppercase}.viewport{position:relative;margin:42px 0 18px;background:#fff;overflow:auto;border:1px solid var(--line);max-height:720px}.viewport img{display:block;width:${report.document.width}px;max-width:none}.viewport svg{position:absolute;inset:0;width:${report.document.width}px;height:${report.document.height}px;pointer-events:none}.viewport line{stroke:var(--green);stroke-width:2;stroke-dasharray:6 6}.focus-node rect,.focus-node polygon{fill:rgba(182,255,85,.08);stroke:var(--green);stroke-width:3}.focus-node circle{fill:#0a0b0b;stroke:var(--green);stroke-width:2}.focus-node text{fill:var(--green);font:bold 11px ui-monospace;text-anchor:middle}.visual-note{margin:0 0 42px;padding:16px 18px;border-left:3px solid var(--amber);background:var(--panel);color:var(--muted)}.visual-note strong{color:var(--ink)}.section{padding:34px 0;border-top:1px solid var(--line)}h2{font:650 26px ui-sans-serif,system-ui;margin:0 0 22px}.issues{list-style:none;margin:0;padding:0}.issue{display:grid;grid-template-columns:90px 80px minmax(180px,1fr) 2fr;gap:14px;padding:16px 0;border-top:1px solid var(--line);align-items:start}.issue span{text-transform:uppercase;font-size:11px;font-weight:800}.issue.error span{color:var(--red)}.issue.warning span{color:var(--amber)}.issue p{margin:0;color:var(--muted)}code{color:#c9d3cb;overflow-wrap:anywhere}.empty{color:var(--green);padding:18px 0}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:12px;border-top:1px solid var(--line);vertical-align:top}th{color:var(--muted)}tbody th{color:var(--ink)}footer{padding:40px 0 70px;color:var(--muted)}@media(max-width:720px){.summary{display:grid;grid-template-columns:1fr 1fr}.issue{grid-template-columns:80px 1fr}.issue code,.issue p{grid-column:1/-1}.table-wrap{overflow:auto}}@media(forced-colors:active){.viewport line,.focus-node rect,.focus-node polygon,.focus-node circle{stroke:CanvasText}.focus-node text{fill:CanvasText}}@media print{body{background:#fff;color:#000}.viewport{max-height:none}.skip-link{display:none}.section,header{border-color:#777}code,.url,.issue p,footer{color:#333}}
</style></head><body><a class="skip-link" href="#findings">Skip visual overview</a><header><div class="brand">FocusPath / Report</div><h1>${reportTitle}</h1><div class="url">${escapeHtml(report.url)}</div><dl class="summary"><div class="metric"><dt>focus stops</dt><dd>${report.steps.length}</dd></div><div class="metric"><dt>direction</dt><dd>${report.direction}</dd></div><div class="metric"><dt>Tab presses</dt><dd>${report.tabPressCount}</dd></div><div class="metric"><dt>errors</dt><dd>${errors}</dd></div><div class="metric"><dt>warnings</dt><dd>${warnings}</dd></div><div class="metric"><dt>scan time</dt><dd>${report.durationMs}ms</dd></div></dl></header><main><figure class="viewport"><img src="${screenshot}" alt="Screenshot of ${reportTitle} at scan time"><svg viewBox="0 0 ${report.document.width} ${report.document.height}" aria-hidden="true" focusable="false">${path}</svg><figcaption class="sr-only">Visual overlay of the ${report.direction} keyboard focus path. Steps affected by independently scrollable containers are identified in the table instead of being positioned over a different screenshot state.</figcaption></figure>${captureNote}${visualNote}${networkNote}<section class="section" id="findings" tabindex="-1"><h2>Findings</h2><ul class="issues">${issueRows}</ul></section><section class="section"><h2>Focus sequence</h2><div class="table-wrap"><table><caption class="sr-only">Focus stops in ${report.direction} keyboard traversal order</caption><thead><tr><th scope="col">#</th><th scope="col">Element</th><th scope="col">Role</th><th scope="col">Name</th><th scope="col">Computed focus styles</th><th scope="col">Visual evidence</th></tr></thead><tbody>${stepRows}</tbody></table></div></section><footer>Generated <time datetime="${escapeHtml(report.scannedAt)}">${escapeHtml(report.scannedAt)}</time> · direction: ${report.direction} · stopped: ${escapeHtml(stopReason)} · limits: ${report.limits.maxSteps} stops / ${report.limits.maxTabPresses} Tab presses / ${report.limits.maxOpaqueTabPresses} per opaque host · report schema v${report.version}</footer></main></body></html>`;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function scrollContextsFor(step: FocusReport["steps"][number]) {
  if (step.scrollContexts && step.scrollContexts.length > 0) return step.scrollContexts;
  return step.scrollContext ? [step.scrollContext] : [];
}

function isPlottable(step: FocusReport["steps"][number], report: FocusReport): boolean {
  const status = visualEvidenceFor(step, report);
  return status === "plotted" || status === "partially-visible";
}

function visualEvidenceFor(step: FocusReport["steps"][number], report: FocusReport) {
  if (step.visualEvidence) return step.visualEvidence.status;
  if (scrollContextsFor(step).length > 0) return "sequence-only";
  const left = step.rect.x;
  const top = step.rect.y;
  const right = left + step.rect.width;
  const bottom = top + step.rect.height;
  if (right <= 0 || bottom <= 0 || left >= report.document.width || top >= report.document.height) return "outside-capture";
  if (left < 0 || top < 0 || right > report.document.width || bottom > report.document.height) return "partially-visible";
  return "plotted";
}

function evidencePoint(step: FocusReport["steps"][number], report: FocusReport): [number, number] {
  const x = step.rect.x + step.rect.width / 2;
  const y = step.rect.y + step.rect.height / 2;
  if (visualEvidenceFor(step, report) !== "partially-visible") return [x, y];
  return [Math.max(13, Math.min(report.document.width - 13, x)), Math.max(13, Math.min(report.document.height - 13, y))];
}

function quadPoints(quad: number[]): string {
  return [0, 2, 4, 6].map((index) => `${quad[index]},${quad[index + 1]}`).join(" ");
}

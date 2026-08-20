import type { FocusReport } from "./types.js";

export function generateHtmlReport(report: FocusReport): string {
  const errors = report.issues.filter((issue) => issue.severity === "error").length;
  const warnings = report.issues.filter((issue) => issue.severity === "warning").length;
  const path = report.steps
    .map((step, index) => {
      const next = report.steps[index + 1];
      const x1 = step.rect.x + step.rect.width / 2;
      const y1 = step.rect.y + step.rect.height / 2;
      const line = next
        ? `<line x1="${x1}" y1="${y1}" x2="${next.rect.x + next.rect.width / 2}" y2="${next.rect.y + next.rect.height / 2}" />`
        : "";
      return `${line}<g class="focus-node"><rect x="${step.rect.x}" y="${step.rect.y}" width="${Math.max(step.rect.width, 20)}" height="${Math.max(step.rect.height, 20)}" rx="4"/><circle cx="${x1}" cy="${y1}" r="13"/><text x="${x1}" y="${y1 + 4}">${step.index}</text></g>`;
    })
    .join("");

  const issueRows = report.issues.length
    ? report.issues.map((issue) => `<li class="issue ${issue.severity}"><span>${issue.severity}</span><strong>Step ${issue.step}</strong><code>${escapeHtml(issue.selector)}</code><p>${escapeHtml(issue.message)}</p></li>`).join("")
    : `<li class="empty">No automatically detectable focus-order issues found.</li>`;

  const stepRows = report.steps.map((step) => `<tr><td>${step.index}</td><td><code>${escapeHtml(step.selector)}</code></td><td>${escapeHtml(step.role ?? step.tagName)}</td><td>${escapeHtml(step.accessibleName || "—")}</td><td>${escapeHtml(step.focusIndicator.outline)}</td></tr>`).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FocusPath — ${escapeHtml(report.title || report.url)}</title>
<style>
:root{color-scheme:dark;--bg:#0a0b0b;--panel:#121413;--ink:#f1f5ef;--muted:#929b94;--line:#2a302c;--green:#b6ff55;--red:#ff6b5d;--amber:#ffc857}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}header,main{width:min(1180px,calc(100% - 40px));margin:auto}header{padding:48px 0 32px;border-bottom:1px solid var(--line)}.brand{color:var(--green);font-weight:800;letter-spacing:.12em;text-transform:uppercase}h1{font:700 clamp(34px,6vw,72px)/.98 ui-sans-serif,system-ui;margin:18px 0;max-width:900px;letter-spacing:-.055em}.url{color:var(--muted);overflow-wrap:anywhere}.summary{display:flex;gap:32px;padding:24px 0}.metric strong{display:block;font:700 30px/1 ui-sans-serif,system-ui}.metric span{color:var(--muted);font-size:12px;text-transform:uppercase}.viewport{position:relative;margin:42px 0;background:#fff;overflow:auto;border:1px solid var(--line);max-height:720px}.viewport img{display:block;width:${report.document.width}px;max-width:none}.viewport svg{position:absolute;inset:0;width:${report.document.width}px;height:${report.document.height}px;pointer-events:none}.viewport line{stroke:var(--green);stroke-width:2;stroke-dasharray:6 6}.focus-node rect{fill:rgba(182,255,85,.08);stroke:var(--green);stroke-width:3}.focus-node circle{fill:#0a0b0b;stroke:var(--green);stroke-width:2}.focus-node text{fill:var(--green);font:bold 11px ui-monospace;text-anchor:middle}.section{padding:34px 0;border-top:1px solid var(--line)}h2{font:650 26px ui-sans-serif,system-ui;margin:0 0 22px}.issues{list-style:none;margin:0;padding:0}.issue{display:grid;grid-template-columns:90px 80px minmax(180px,1fr) 2fr;gap:14px;padding:16px 0;border-top:1px solid var(--line);align-items:start}.issue span{text-transform:uppercase;font-size:11px;font-weight:800}.issue.error span{color:var(--red)}.issue.warning span{color:var(--amber)}.issue p{margin:0;color:var(--muted)}code{color:#c9d3cb;overflow-wrap:anywhere}.empty{color:var(--green);padding:18px 0}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:12px;border-top:1px solid var(--line);vertical-align:top}th{color:var(--muted)}footer{padding:40px 0 70px;color:var(--muted)}@media(max-width:720px){.summary{display:grid;grid-template-columns:1fr 1fr}.issue{grid-template-columns:80px 1fr}.issue code,.issue p{grid-column:1/-1}.table-wrap{overflow:auto}}
</style></head><body><header><div class="brand">FocusPath / Report</div><h1>${escapeHtml(report.title || "Untitled page")}</h1><div class="url">${escapeHtml(report.url)}</div><div class="summary"><div class="metric"><strong>${report.steps.length}</strong><span>focus stops</span></div><div class="metric"><strong>${errors}</strong><span>errors</span></div><div class="metric"><strong>${warnings}</strong><span>warnings</span></div><div class="metric"><strong>${report.durationMs}ms</strong><span>scan time</span></div></div></header><main><div class="viewport"><img src="${report.screenshot}" alt="Full-page screenshot of the tested page"><svg viewBox="0 0 ${report.document.width} ${report.document.height}" aria-label="Focus path overlay">${path}</svg></div><section class="section"><h2>Findings</h2><ul class="issues">${issueRows}</ul></section><section class="section"><h2>Focus sequence</h2><div class="table-wrap"><table><thead><tr><th>#</th><th>Element</th><th>Role</th><th>Name</th><th>Detected outline</th></tr></thead><tbody>${stepRows}</tbody></table></div></section><footer>Generated ${escapeHtml(report.scannedAt)} · stopped: ${escapeHtml(report.stoppedBecause)} · FocusPath v0.1</footer></main></body></html>`;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

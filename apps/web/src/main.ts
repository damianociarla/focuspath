import "./styles.css";

interface ScanIssue {
  severity: "error" | "warning";
  step: number;
  message: string;
}

interface ScanResponse {
  url: string;
  title: string;
  durationMs: number;
  steps: unknown[];
  issues: ScanIssue[];
  reportHtml: string;
}

const command = "npx focuspath https://your-site.com";

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-copy-command]")) {
  button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(command);
    const label = button.querySelector("b");
    if (!label) return;
    label.textContent = "Copied";
    button.classList.add("copied");
    window.setTimeout(() => {
      label.textContent = "Copy";
      button.classList.remove("copied");
    }, 1600);
  });
}

const findings: Record<string, { title: string; code: string; copy: string }> = {
  "1": { title: "Clear navigation landmark", code: "nav[aria-label='Primary']", copy: "The first stop is named and follows the visual reading order." },
  "2": { title: "Visible focus indicator", code: "a.primary-action", copy: "A high-contrast outline remains visible against the page surface." },
  "3": { title: "Missing accessible name", code: "button.icon-only", copy: "Focusable control cannot be identified by assistive technology." },
  "4": { title: "Natural document order", code: "a.footer-link", copy: "The final stop completes the page without a positive tabindex override." },
};

for (const node of document.querySelectorAll<HTMLButtonElement>("[data-step]")) {
  node.addEventListener("click", () => {
    const key = node.dataset.step ?? "3";
    const finding = findings[key];
    if (!finding) return;
    document.querySelectorAll(".report-node").forEach((item) => item.classList.remove("active"));
    node.classList.add("active");
    setText("[data-finding-step]", key.padStart(2, "0"));
    setText("[data-finding-title]", finding.title);
    setText("[data-finding-code]", finding.code);
    setText("[data-finding-copy]", finding.copy);
  });
}

function setText(selector: string, value: string): void {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

const revealObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) entry.target.classList.add("in-view");
  }
}, { threshold: 0.18 });

document.querySelectorAll(".proof-heading, .workflow-intro, .workflow-list li, .cta").forEach((element) => revealObserver.observe(element));

const scanForm = document.querySelector<HTMLFormElement>("[data-scan-form]");
const scanApiUrl = import.meta.env.VITE_API_URL || (location.hostname === "localhost" || location.hostname === "127.0.0.1" ? "http://localhost:8787" : "");
let reportObjectUrl = "";

scanForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = scanForm.elements.namedItem("url");
  if (!(input instanceof HTMLInputElement) || !input.reportValidity()) return;
  if (!scanApiUrl) {
    setScanState("error", "The live scanner is not connected yet. The CLI remains available from GitHub.");
    return;
  }

  const button = scanForm.querySelector<HTMLButtonElement>("button[type='submit']");
  if (button) button.disabled = true;
  setScanState("progress");
  const started = Date.now();
  const stages = ["Opening page…", "Following keyboard focus…", "Drawing the route…"];
  let stage = 0;
  const stageTimer = window.setInterval(() => {
    stage = Math.min(stage + 1, stages.length - 1);
    setText("[data-scan-stage]", stages[stage] ?? stages[0] ?? "Scanning…");
    setText("[data-scan-elapsed]", `${Math.round((Date.now() - started) / 1000)}s`);
  }, 2600);

  try {
    const response = await fetch(`${scanApiUrl.replace(/\/$/, "")}/v1/scans`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: input.value }),
    });
    const payload = await response.json() as ScanResponse | { error?: string };
    if (!response.ok || !("reportHtml" in payload)) throw new Error("error" in payload ? payload.error : "The scan could not be completed.");
    showScanResult(payload);
  } catch (error) {
    setScanState("error", error instanceof Error ? error.message : "The scan could not be completed.");
  } finally {
    window.clearInterval(stageTimer);
    if (button) button.disabled = false;
  }
});

function setScanState(state: "idle" | "progress" | "error" | "result", error = ""): void {
  const output = document.querySelector<HTMLElement>("[data-scan-output]");
  if (output) output.dataset.state = state;
  for (const name of ["idle", "progress", "error", "result"] as const) {
    const element = document.querySelector<HTMLElement>(`[data-scan-${name}]`);
    if (element) element.hidden = name !== state;
  }
  if (state === "progress") {
    setText("[data-scan-stage]", "Opening page…");
    setText("[data-scan-elapsed]", "0s");
  }
  if (state === "error") {
    setText("[data-scan-error-copy]", error);
    setText("[data-scan-elapsed]", "Stopped");
  }
}

function showScanResult(result: ScanResponse): void {
  setScanState("result");
  const errors = result.issues.filter((issue) => issue.severity === "error").length;
  const warnings = result.issues.filter((issue) => issue.severity === "warning").length;
  setText("[data-scan-elapsed]", `${(result.durationMs / 1000).toFixed(1)}s`);
  setText("[data-result-status]", errors > 0 ? "Action needed" : "Scan complete");
  setText("[data-result-title]", result.title || "Untitled page");
  setText("[data-result-url]", result.url);
  setText("[data-result-stops]", String(result.steps.length));
  setText("[data-result-errors]", String(errors));
  setText("[data-result-warnings]", String(warnings));

  const list = document.querySelector<HTMLUListElement>("[data-result-issues]");
  if (list) {
    list.replaceChildren();
    if (result.issues.length === 0) {
      const item = document.createElement("li");
      item.textContent = "No deterministic focus-order issues detected.";
      list.append(item);
    } else {
      for (const issue of result.issues.slice(0, 3)) {
        const item = document.createElement("li");
        const label = document.createElement("span");
        label.textContent = `${issue.severity} / step ${issue.step}`;
        const message = document.createElement("p");
        message.textContent = issue.message;
        item.append(label, message);
        list.append(item);
      }
    }
  }

  if (reportObjectUrl) URL.revokeObjectURL(reportObjectUrl);
  reportObjectUrl = URL.createObjectURL(new Blob([result.reportHtml], { type: "text/html" }));
  for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-open-report], [data-download-report]")) link.href = reportObjectUrl;
}

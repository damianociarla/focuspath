import "./styles.css";

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

import { chromium } from "playwright";
import type { FocusIssue, FocusReport, FocusStep, ScanOptions } from "./types.js";

const DEFAULT_VIEWPORT = { width: 1440, height: 900 };

export async function scanFocusPath(url: string, options: ScanOptions = {}): Promise<FocusReport> {
  const startedAt = Date.now();
  const maxSteps = options.maxSteps ?? 50;
  const viewport = options.viewport ?? DEFAULT_VIEWPORT;
  const browser = await chromium.launch({ headless: options.headless ?? true });

  try {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    if (options.isUrlAllowed) {
      await page.route("**/*", async (route) => {
        try {
          const allowed = await options.isUrlAllowed?.(route.request().url());
          if (allowed) await route.continue();
          else await route.abort("blockedbyclient");
        } catch {
          await route.abort("blockedbyclient");
        }
      });
    }
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: options.timeoutMs ?? 30_000,
    });

    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
    });

    const steps: FocusStep[] = [];
    const issues: FocusIssue[] = [];
    const seen = new Map<string, number>();
    let stoppedBecause: FocusReport["stoppedBecause"] = "limit";
    let previousSelector = "";

    for (let index = 1; index <= maxSteps; index += 1) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(35);
      const step = await readActiveElement(page, index);

      if (!step) {
        stoppedBecause = steps.length === 0 ? "no-focusable-elements" : "focus-stalled";
        break;
      }

      if (step.selector === previousSelector) {
        issues.push({
          kind: "focus-stalled",
          severity: "warning",
          step: index,
          selector: step.selector,
          message: "Focus did not move after pressing Tab.",
        });
        stoppedBecause = "focus-stalled";
        break;
      }

      if (seen.has(step.selector)) {
        stoppedBecause = "cycle";
        break;
      }

      seen.set(step.selector, index);
      previousSelector = step.selector;
      steps.push(step);
      issues.push(...issuesFor(step));
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    const [metadata, screenshot] = await Promise.all([
      page.evaluate(() => ({
        title: document.title,
        width: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0),
        height: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0),
      })),
      page.screenshot({ fullPage: true, type: "jpeg", quality: 78 }),
    ]);

    return {
      version: 1,
      url: page.url(),
      title: metadata.title,
      scannedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      viewport,
      document: { width: metadata.width, height: metadata.height },
      steps,
      issues,
      screenshot: `data:image/jpeg;base64,${screenshot.toString("base64")}`,
      stoppedBecause,
    };
  } finally {
    await browser.close();
  }
}

function issuesFor(step: FocusStep): FocusIssue[] {
  const issues: FocusIssue[] = [];
  const needsName = ["a", "button", "input", "select", "textarea"].includes(step.tagName) || step.role !== null;

  if (needsName && !step.accessibleName) {
    issues.push({
      kind: "missing-name",
      severity: "error",
      step: step.index,
      selector: step.selector,
      message: "Focusable control has no detectable accessible name.",
    });
  }

  if (step.tabIndex > 0) {
    issues.push({
      kind: "positive-tabindex",
      severity: "warning",
      step: step.index,
      selector: step.selector,
      message: `Positive tabindex (${step.tabIndex}) overrides the natural focus order.`,
    });
  }

  return issues;
}

async function readActiveElement(page: import("playwright").Page, index: number): Promise<FocusStep | null> {
  return page.evaluate((stepIndex) => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement) || element === document.body || element === document.documentElement) return null;

    const selector = uniqueSelector(element);
    const rect = element.getBoundingClientRect();
    const styles = getComputedStyle(element);
    const tagName = element.tagName.toLowerCase();
    const explicitRole = element.getAttribute("role");
    const implicitRoles: Record<string, string> = {
      a: "link",
      button: "button",
      input: element.getAttribute("type") === "checkbox" ? "checkbox" : "textbox",
      select: "combobox",
      textarea: "textbox",
    };

    return {
      index: stepIndex,
      selector,
      tagName,
      role: explicitRole ?? implicitRoles[tagName] ?? null,
      accessibleName: getAccessibleName(element),
      tabIndex: element.tabIndex,
      href: element instanceof HTMLAnchorElement ? element.href : null,
      rect: {
        x: Math.round(rect.x + window.scrollX),
        y: Math.round(rect.y + window.scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      focusIndicator: {
        outline: `${styles.outlineWidth} ${styles.outlineStyle} ${styles.outlineColor}`,
        boxShadow: styles.boxShadow,
      },
    };

    function getAccessibleName(node: HTMLElement): string {
      const labelledBy = node.getAttribute("aria-labelledby");
      if (labelledBy) {
        const value = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
          .filter(Boolean)
          .join(" ");
        if (value) return value;
      }

      const ariaLabel = node.getAttribute("aria-label")?.trim();
      if (ariaLabel) return ariaLabel;
      if (node instanceof HTMLImageElement && node.alt.trim()) return node.alt.trim();
      if (node instanceof HTMLInputElement) {
        const labels = Array.from(node.labels ?? []).map((label) => label.textContent?.trim() ?? "").filter(Boolean);
        if (labels.length) return labels.join(" ");
        if (node.placeholder.trim()) return node.placeholder.trim();
        if (["button", "submit", "reset"].includes(node.type) && node.value.trim()) return node.value.trim();
      }
      return (node.innerText || node.getAttribute("title") || "").trim().replace(/\s+/g, " ").slice(0, 160);
    }

    function uniqueSelector(node: Element): string {
      if (node.id) return `#${CSS.escape(node.id)}`;
      const parts: string[] = [];
      let current: Element | null = node;
      while (current && current !== document.documentElement && parts.length < 5) {
        let part = current.tagName.toLowerCase();
        const parent: Element | null = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter((child) => child.tagName === current?.tagName);
          if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
        parts.unshift(part);
        current = parent;
      }
      return parts.join(" > ");
    }
  }, index);
}

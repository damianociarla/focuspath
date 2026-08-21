import { chromium, type Browser, type CDPSession, type Page } from "playwright";
import type { FocusIssue, FocusReport, FocusStep, ScanOptions } from "./types.js";

const DEFAULT_VIEWPORT = { width: 1440, height: 900 };
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_FOCUS_SETTLE_MS = 75;

export class ScanTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Scan exceeded the ${timeoutMs}ms time limit.`);
    this.name = "ScanTimeoutError";
  }
}

export async function scanFocusPath(url: string, options: ScanOptions = {}): Promise<FocusReport> {
  const startedAt = Date.now();
  const maxSteps = options.maxSteps ?? 50;
  const viewport = options.viewport ?? DEFAULT_VIEWPORT;
  const maxRequests = options.maxRequests ?? Number.POSITIVE_INFINITY;
  const blockedResourceTypes = new Set(options.blockedResourceTypes ?? []);
  const maxScreenshotHeight = options.maxScreenshotHeight ?? Number.POSITIVE_INFINITY;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const focusSettleMs = options.focusSettleMs ?? DEFAULT_FOCUS_SETTLE_MS;
  let browser: Browser | undefined;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    void browser?.close();
  }, timeoutMs);

  try {
    browser = await chromium.launch({ headless: options.headless ?? true });
    if (timedOut) throw new ScanTimeoutError(timeoutMs);
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const cdp = await page.context().newCDPSession(page);
    let requestCount = 0;
    if (options.isUrlAllowed || Number.isFinite(maxRequests) || blockedResourceTypes.size > 0) {
      await page.route("**/*", async (route) => {
        try {
          requestCount += 1;
          if (requestCount > maxRequests || blockedResourceTypes.has(route.request().resourceType())) {
            await route.abort("blockedbyclient");
            return;
          }
          const allowed = await options.isUrlAllowed?.(route.request().url());
          if (allowed ?? true) await route.continue();
          else await route.abort("blockedbyclient");
        } catch {
          await route.abort("blockedbyclient");
        }
      });
    }
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: remainingTime(startedAt, timeoutMs),
    });

    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
    });

    const steps: FocusStep[] = [];
    const issues: FocusIssue[] = [];
    const seen = new Map<string, number>();
    let stoppedBecause: FocusReport["stoppedBecause"] = "step-limit";
    let previousSelector = "";

    for (let index = 1; index <= maxSteps; index += 1) {
      await page.keyboard.press("Tab");
      await settleFocus(page, focusSettleMs);
      if (timedOut) throw new ScanTimeoutError(timeoutMs);
      const step = await readActiveElement(page, cdp, index);

      if (!step) {
        stoppedBecause = steps.length === 0 ? "no-focusable-elements" : "document-exhausted";
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
        stoppedBecause = "stalled-on-element";
        break;
      }

      if (seen.has(step.selector)) {
        stoppedBecause = "cycle-complete";
        break;
      }

      seen.set(step.selector, index);
      previousSelector = step.selector;
      steps.push(step);
      issues.push(...issuesFor(step));
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    const metadata = await page.evaluate(() => ({
        title: document.title,
        width: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0),
        height: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0),
      }));
    const captureWidth = Math.max(1, Math.min(metadata.width, viewport.width));
    const captureHeight = Math.max(1, Math.min(metadata.height, maxScreenshotHeight));
    const screenshot = await page.screenshot({
      clip: { x: 0, y: 0, width: captureWidth, height: captureHeight },
      type: "jpeg",
      quality: 78,
    });

    return {
      version: 1,
      url: page.url(),
      title: metadata.title,
      scannedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      viewport,
      document: { width: captureWidth, height: captureHeight },
      steps,
      issues,
      screenshot: `data:image/jpeg;base64,${screenshot.toString("base64")}`,
      stoppedBecause,
    };
  } catch (error) {
    if (timedOut && !(error instanceof ScanTimeoutError)) throw new ScanTimeoutError(timeoutMs);
    throw error;
  } finally {
    clearTimeout(timeout);
    await browser?.close().catch(() => undefined);
  }
}

function remainingTime(startedAt: number, timeoutMs: number): number {
  return Math.max(1, timeoutMs - (Date.now() - startedAt));
}

async function settleFocus(page: Page, delayMs: number): Promise<void> {
  if (delayMs > 0) await page.waitForTimeout(delayMs);
  await page.evaluate(() => new Promise<void>((resolve) => {
    let previous = "";
    let stableFrames = 0;
    let sampledFrames = 0;
    const sample = () => {
      const element = document.activeElement;
      const rect = element instanceof HTMLElement ? element.getBoundingClientRect() : null;
      const current = rect ? [rect.x, rect.y, rect.width, rect.height].map((value) => value.toFixed(2)).join(":") : "none";
      stableFrames = current === previous ? stableFrames + 1 : 0;
      previous = current;
      sampledFrames += 1;
      if (stableFrames >= 2 || sampledFrames >= 8) resolve();
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
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
      message: "Focusable control has no computed accessible name.",
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

async function readActiveElement(page: Page, cdp: CDPSession, index: number): Promise<FocusStep | null> {
  let accessibleName = "";
  let computedRole = "";
  try {
    const active = await cdp.send("Runtime.evaluate", { expression: "document.activeElement", objectGroup: "focuspath" });
    if (active.result.objectId) {
      const tree = await cdp.send("Accessibility.getPartialAXTree", { objectId: active.result.objectId, fetchRelatives: false });
      accessibleName = String(tree.nodes[0]?.name?.value ?? "").trim();
      computedRole = String(tree.nodes[0]?.role?.value ?? "").trim();
    }
  } finally {
    await cdp.send("Runtime.releaseObjectGroup", { objectGroup: "focuspath" });
  }

  return page.evaluate(({ stepIndex, computedName, accessibilityRole }) => {
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
      role: accessibilityRole || explicitRole || implicitRoles[tagName] || null,
      accessibleName: computedName,
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
  }, { stepIndex: index, computedName: accessibleName.slice(0, 160), accessibilityRole: computedRole });
}

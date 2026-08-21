import { chromium, type Browser, type CDPSession, type Page } from "playwright";
import type { FocusIssue, FocusRect, FocusReport, FocusStep, ScanOptions, VisualEvidence } from "./types.js";

const DEFAULT_VIEWPORT = { width: 1440, height: 900 };
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_FOCUS_SETTLE_MS = 75;
const DEFAULT_MAX_OPAQUE_TAB_PRESSES = 100;
const NAMED_CONTROL_ROLES = new Set([
  "button", "checkbox", "combobox", "link", "listbox", "menuitem", "menuitemcheckbox", "menuitemradio",
  "option", "radio", "searchbox", "slider", "spinbutton", "switch", "tab", "textbox", "treeitem",
]);
const GENERIC_ROLES = new Set(["generic", "none", "presentation"]);
const DEEPEST_ACTIVE_ELEMENT_EXPRESSION = `(() => {
  let element = document.activeElement;
  while (element?.nodeType === Node.ELEMENT_NODE) {
    const shadowActive = element.shadowRoot?.activeElement;
    if (shadowActive?.nodeType === Node.ELEMENT_NODE) { element = shadowActive; continue; }
    if (element.tagName === "IFRAME") {
      try {
        const frameActive = element.contentDocument?.activeElement;
        if (frameActive?.nodeType === Node.ELEMENT_NODE && frameActive !== element.contentDocument?.body) { element = frameActive; continue; }
      } catch {}
    }
    break;
  }
  return element;
})()`;

type ObservedFocusStep = FocusStep & {
  identity: string;
  backendNodeId: number;
  confirmedOpaqueHost: boolean;
  opaqueCandidate: boolean;
};

type NodeGeometry = { rect: FocusRect; quad: number[] };

export class ScanTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Scan exceeded the ${timeoutMs}ms time limit.`);
    this.name = "ScanTimeoutError";
  }
}

export async function scanFocusPath(url: string, options: ScanOptions = {}): Promise<FocusReport> {
  const startedAt = Date.now();
  const maxSteps = positiveInteger(options.maxSteps ?? 50, "maxSteps");
  const maxTabPresses = positiveInteger(options.maxTabPresses ?? maxSteps * 4, "maxTabPresses");
  const maxOpaqueTabPresses = positiveInteger(options.maxOpaqueTabPresses ?? DEFAULT_MAX_OPAQUE_TAB_PRESSES, "maxOpaqueTabPresses");
  const direction = options.direction ?? "forward";
  if (direction !== "forward" && direction !== "reverse") throw new TypeError("direction must be either forward or reverse.");
  const traversalKey = direction === "reverse" ? "Shift+Tab" : "Tab";
  const viewport = options.viewport ?? DEFAULT_VIEWPORT;
  const maxRequests = options.maxRequests ?? Number.POSITIVE_INFINITY;
  const blockedResourceTypes = new Set(options.blockedResourceTypes ?? []);
  const maxScreenshotHeight = options.maxScreenshotHeight ?? Number.POSITIVE_INFINITY;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const focusSettleMs = options.focusSettleMs ?? DEFAULT_FOCUS_SETTLE_MS;
  let browser: Browser | undefined;
  let timedOut = false;
  let closePromise: Promise<void> | undefined;
  const closeBrowser = (): Promise<void> => {
    if (!browser) return Promise.resolve();
    closePromise ??= browser.close().catch(() => undefined);
    return closePromise;
  };
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      timedOut = true;
      reject(new ScanTimeoutError(timeoutMs));
      void closeBrowser();
    }, timeoutMs);
  });

  const scan = async (): Promise<FocusReport> => {
    browser = await chromium.launch({
      headless: options.headless ?? true,
      ...(options.proxyServer ? {
        proxy: { server: options.proxyServer },
        args: [
          "--disable-quic",
          "--proxy-bypass-list=<-loopback>",
          "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
        ],
      } : {}),
    });
    if (timedOut) {
      await closeBrowser();
      throw new ScanTimeoutError(timeoutMs);
    }
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1, serviceWorkers: "block" });
    await page.addInitScript(() => {
      const state = window as Window & { __focusPathTabCanceled?: boolean };
      const defer = window.setTimeout.bind(window);
      state.__focusPathTabCanceled = false;
      window.addEventListener("keydown", (event) => {
        if (event.key !== "Tab") return;
        defer(() => {
          state.__focusPathTabCanceled = event.defaultPrevented;
        }, 0);
      }, { capture: true });
    });
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
    await page.waitForFunction(() => Array.from(document.querySelectorAll("iframe")).every((frame) => {
      try {
        return frame.contentDocument === null || frame.contentDocument.readyState !== "loading";
      } catch {
        return true;
      }
    }), undefined, { timeout: Math.min(1_000, remainingTime(startedAt, timeoutMs)) }).catch(() => undefined);

    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
    });

    const steps: FocusStep[] = [];
    const backendNodeIds: number[] = [];
    const issues: FocusIssue[] = [];
    const seen = new Map<string, number>();
    let stoppedBecause: FocusReport["stoppedBecause"] = "step-limit";
    let previousIdentity = "";
    let previousWasConfirmedOpaque = false;
    let previousWasOpaqueCandidate = false;
    let opaqueTabCount = 0;
    let tabPressCount = 0;

    while (steps.length < maxSteps && tabPressCount < maxTabPresses) {
      await page.evaluate(() => {
        (window as Window & { __focusPathTabCanceled?: boolean }).__focusPathTabCanceled = false;
      });
      await page.keyboard.press(traversalKey);
      tabPressCount += 1;
      await settleFocus(page, focusSettleMs);
      if (timedOut) throw new ScanTimeoutError(timeoutMs);
      const tabWasCanceled = await page.evaluate(() => (
        (window as Window & { __focusPathTabCanceled?: boolean }).__focusPathTabCanceled === true
      ));
      const observed = await readActiveElement(page, cdp, steps.length + 1);

      if (!observed) {
        stoppedBecause = steps.length === 0 ? "no-focusable-elements" : "document-exhausted";
        break;
      }

      const repeatedElement = observed.identity === previousIdentity;
      if (repeatedElement && tabWasCanceled) {
        const existingStep = seen.get(observed.identity) ?? Math.max(1, steps.length);
        issues.push({
          kind: "focus-stalled",
          severity: "warning",
          step: existingStep,
          selector: observed.selector,
          message: "Focus did not move because the page canceled the Tab key event.",
        });
        stoppedBecause = "stalled-on-element";
        break;
      }
      const repeatedOpaqueHost = repeatedElement && (
        previousWasConfirmedOpaque
        || observed.confirmedOpaqueHost
        || (previousWasOpaqueCandidate && observed.opaqueCandidate)
      );

      if (repeatedOpaqueHost) {
        const hostStep = seen.get(observed.identity) ?? Math.max(1, steps.length);
        if (!previousWasConfirmedOpaque) {
          previousWasConfirmedOpaque = true;
          issues.push({
            kind: "opaque-focus-host",
            severity: "warning",
            step: hostStep,
            selector: observed.selector,
            message: "Repeated uncanceled Tab movement is consistent with a closed shadow root whose internal controls cannot be inspected.",
          });
        }
        opaqueTabCount += 1;
        if (opaqueTabCount < maxOpaqueTabPresses) continue;
        issues.push({
          kind: "opaque-host-limit",
          severity: "warning",
          step: hostStep,
          selector: observed.selector,
          message: `Focus did not leave the opaque host within ${maxOpaqueTabPresses} repeated Tab presses.`,
        });
        stoppedBecause = "opaque-host-limit";
        break;
      }

      if (repeatedElement) {
        const existingStep = seen.get(observed.identity) ?? Math.max(1, steps.length);
        issues.push({
          kind: "focus-stalled",
          severity: "warning",
          step: existingStep,
          selector: observed.selector,
          message: "Focus did not move after pressing Tab.",
        });
        stoppedBecause = "stalled-on-element";
        break;
      }

      if (seen.has(observed.identity)) {
        stoppedBecause = "cycle-complete";
        break;
      }

      const { identity, backendNodeId, confirmedOpaqueHost, opaqueCandidate, ...step } = observed;
      seen.set(identity, step.index);
      previousIdentity = identity;
      previousWasConfirmedOpaque = confirmedOpaqueHost;
      previousWasOpaqueCandidate = opaqueCandidate;
      opaqueTabCount = 0;
      steps.push(step);
      backendNodeIds.push(backendNodeId);
      issues.push(...issuesFor(step));
      if (confirmedOpaqueHost) {
        issues.push({
          kind: "opaque-focus-host",
          severity: "warning",
          step: step.index,
          selector: step.selector,
          message: "Focus entered a cross-origin frame whose internal controls cannot be inspected.",
        });
      }
    }

    if (steps.length < maxSteps && tabPressCount >= maxTabPresses && stoppedBecause === "step-limit") {
      stoppedBecause = "tab-press-limit";
    }

    await page.evaluate(async () => {
      const root = document.documentElement;
      const scrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      root.style.scrollBehavior = scrollBehavior;
    });
    const finalGeometry = await Promise.all(backendNodeIds.map((backendNodeId) => readNodeGeometry(cdp, backendNodeId)));
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
    const capturedImage = jpegDimensions(screenshot) ?? { width: captureWidth, height: captureHeight };
    const finalSteps = steps.map((step, index) => {
      const geometry = finalGeometry[index];
      const nextStep: FocusStep = geometry
        ? { ...step, observedRect: step.rect, rect: geometry.rect, quad: geometry.quad }
        : { ...step, observedRect: step.rect };
      return {
        ...nextStep,
        visualEvidence: classifyVisualEvidence(nextStep, capturedImage, geometry !== null),
      };
    });

    return {
      version: 2,
      direction,
      url: page.url(),
      title: metadata.title,
      scannedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      tabPressCount,
      limits: { maxSteps, maxTabPresses, maxOpaqueTabPresses },
      viewport,
      // Chromium can return only the viewport when a page locks root scrolling
      // (for example while a consent dialog is open), even when a taller clip
      // was requested. Report the pixels that actually exist so the overlay
      // can never extend into fabricated blank space.
      document: capturedImage,
      steps: finalSteps,
      issues,
      screenshot: `data:image/jpeg;base64,${screenshot.toString("base64")}`,
      stoppedBecause,
    };
  };

  try {
    return await Promise.race([deadline, scan()]);
  } finally {
    if (timeout) clearTimeout(timeout);
    await Promise.race([
      closeBrowser(),
      new Promise<void>((resolve) => setTimeout(resolve, 1_000)),
    ]);
  }
}

function jpegDimensions(image: Buffer): { width: number; height: number } | null {
  if (image.length < 4 || image[0] !== 0xff || image[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 8 < image.length) {
    if (image[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (image[offset] === 0xff) offset += 1;
    const marker = image[offset++];
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 1 >= image.length) break;

    const segmentLength = image.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > image.length) break;
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isStartOfFrame && segmentLength >= 7) {
      return {
        width: image.readUInt16BE(offset + 5),
        height: image.readUInt16BE(offset + 3),
      };
    }
    offset += segmentLength;
  }

  return null;
}

function remainingTime(startedAt: number, timeoutMs: number): number {
  return Math.max(1, timeoutMs - (Date.now() - startedAt));
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) throw new TypeError(`${name} must be a positive integer.`);
  return value;
}

async function settleFocus(page: Page, delayMs: number): Promise<void> {
  if (delayMs > 0) await page.waitForTimeout(delayMs);
  await page.evaluate(() => new Promise<void>((resolve) => {
    let previous = "";
    let stableFrames = 0;
    let sampledFrames = 0;
    const sample = () => {
      let element = document.activeElement;
      while (element?.nodeType === Node.ELEMENT_NODE) {
        const current = element as HTMLElement;
        const shadowActive = current.shadowRoot?.activeElement;
        if (shadowActive?.nodeType === Node.ELEMENT_NODE) {
          element = shadowActive;
          continue;
        }
        if (current.tagName === "IFRAME") {
          try {
            const frameActive = (current as HTMLIFrameElement).contentDocument?.activeElement;
            if (frameActive?.nodeType === Node.ELEMENT_NODE && frameActive !== (current as HTMLIFrameElement).contentDocument?.body) {
              element = frameActive;
              continue;
            }
          } catch {
            // Cross-origin frame contents are intentionally opaque.
          }
        }
        break;
      }
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
  const role = step.role?.toLowerCase() ?? null;

  if (role && GENERIC_ROLES.has(role)) {
    issues.push({
      kind: "missing-or-generic-role",
      severity: "warning",
      step: step.index,
      selector: step.selector,
      message: "Focusable element has no meaningful accessibility role.",
    });
  }

  if (role && NAMED_CONTROL_ROLES.has(role) && !step.accessibleName) {
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

async function readActiveElement(page: Page, cdp: CDPSession, index: number): Promise<ObservedFocusStep | null> {
  let accessibleName = "";
  let computedRole = "";
  let elementIdentity = "";
  let backendNodeId = 0;
  let observedGeometry: NodeGeometry | null = null;
  try {
    const active = await cdp.send("Runtime.evaluate", { expression: DEEPEST_ACTIVE_ELEMENT_EXPRESSION, objectGroup: "focuspath" });
    if (active.result.objectId) {
      const described = await cdp.send("DOM.describeNode", { objectId: active.result.objectId });
      backendNodeId = described.node.backendNodeId;
      elementIdentity = `backend-node:${backendNodeId}`;
      observedGeometry = await readNodeGeometry(cdp, backendNodeId);
      const tree = await cdp.send("Accessibility.getPartialAXTree", { objectId: active.result.objectId, fetchRelatives: false });
      accessibleName = String(tree.nodes[0]?.name?.value ?? "").trim();
      computedRole = String(tree.nodes[0]?.role?.value ?? "").trim();
    }
  } finally {
    await cdp.send("Runtime.releaseObjectGroup", { objectGroup: "focuspath" });
  }

  return page.evaluate(({ stepIndex, computedName, accessibilityRole, identity, nodeId, geometry }) => {
    let element = document.activeElement;
    let confirmedOpaqueHost = false;
    let opaqueCandidate = false;
    while (element?.nodeType === Node.ELEMENT_NODE) {
      const current = element as HTMLElement;
      const shadowActive = current.shadowRoot?.activeElement;
      if (shadowActive?.nodeType === Node.ELEMENT_NODE) {
        element = shadowActive as HTMLElement;
        continue;
      }
      if (current.tagName === "IFRAME") {
        try {
          const frame = current as HTMLIFrameElement;
          const frameDocument = frame.contentDocument;
          const frameActive = frameDocument?.activeElement;
          if (frameActive?.nodeType === Node.ELEMENT_NODE && frameActive !== frameDocument?.body) {
            element = frameActive as HTMLElement;
            continue;
          }
          if (!frameDocument) confirmedOpaqueHost = true;
        } catch {
          // Cross-origin frame contents are intentionally opaque.
          confirmedOpaqueHost = true;
        }
      } else if (current.tagName.includes("-") && current.shadowRoot === null) {
        // A custom element without an open root is only a candidate. It becomes
        // opaque after a repeated observation proves that focus moved internally.
        opaqueCandidate = true;
      }
      break;
    }
    if (!element || element.nodeType !== Node.ELEMENT_NODE || element === document.body || element === document.documentElement) return null;
    const focused = element as HTMLElement;

    const selector = uniqueSelector(focused);
    const rect = geometry?.rect ?? absoluteRect(focused);
    const scrollContexts = collectScrollContexts(focused);
    const styles = focused.ownerDocument.defaultView?.getComputedStyle(focused) ?? getComputedStyle(focused);
    const tagName = focused.tagName.toLowerCase();
    const explicitRole = focused.getAttribute("role");
    const implicitRoles: Record<string, string> = {
      a: "link",
      button: "button",
      input: focused.getAttribute("type") === "checkbox" ? "checkbox" : "textbox",
      select: "combobox",
      textarea: "textbox",
    };

    return {
      index: stepIndex,
      identity,
      backendNodeId: nodeId,
      selector,
      tagName,
      role: accessibilityRole || explicitRole || implicitRoles[tagName] || null,
      accessibleName: computedName,
      tabIndex: focused.tabIndex,
      href: focused.tagName === "A" ? (focused as HTMLAnchorElement).href : null,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      ...(geometry ? { quad: geometry.quad } : {}),
      focusIndicator: {
        outline: `${styles.outlineWidth} ${styles.outlineStyle} ${styles.outlineColor}`,
        boxShadow: styles.boxShadow,
      },
      ...(scrollContexts.length > 0 ? {
        scrollContexts,
        scrollContext: scrollContexts[0],
      } : {}),
      confirmedOpaqueHost,
      opaqueCandidate,
    };

    function absoluteRect(node: HTMLElement): { x: number; y: number; width: number; height: number } {
      const rect = node.getBoundingClientRect();
      let x = rect.x;
      let y = rect.y;
      let current: HTMLElement = node;
      let view = node.ownerDocument.defaultView;

      if (view && view.getComputedStyle(current).position !== "fixed") {
        x += view.scrollX;
        y += view.scrollY;
      }

      while (view?.frameElement) {
        current = view.frameElement as HTMLElement;
        const frameRect = current.getBoundingClientRect();
        x += frameRect.x;
        y += frameRect.y;
        view = current.ownerDocument.defaultView;
        if (view && view.getComputedStyle(current).position !== "fixed") {
          x += view.scrollX;
          y += view.scrollY;
        }
      }

      return { x, y, width: rect.width, height: rect.height };
    }

    function collectScrollContexts(node: HTMLElement): Array<{
      kind: "element" | "viewport";
      selector: string;
      scrollLeft: number;
      scrollTop: number;
    }> {
      const contexts: Array<{
        kind: "element" | "viewport";
        selector: string;
        scrollLeft: number;
        scrollTop: number;
      }> = [];
      let current: Element = node;

      while (true) {
        let ancestor = composedParent(current);
        while (ancestor) {
          if (isHtmlElement(ancestor) && isScrollableElement(ancestor)) {
            contexts.push({
              kind: "element",
              selector: uniqueSelector(ancestor),
              scrollLeft: Math.round(ancestor.scrollLeft),
              scrollTop: Math.round(ancestor.scrollTop),
            });
          }
          ancestor = composedParent(ancestor);
        }

        const ownerDocument = current.ownerDocument;
        const view = ownerDocument.defaultView;
        const frameElement = view?.frameElement;
        if (!frameElement || !view || !isHtmlElement(frameElement)) break;

        const scrollingElement = ownerDocument.scrollingElement ?? ownerDocument.documentElement;
        const viewportClipsX = scrollingElement.scrollWidth > view.innerWidth;
        const viewportClipsY = scrollingElement.scrollHeight > view.innerHeight;
        if (viewportClipsX || viewportClipsY) {
          contexts.push({
            kind: "viewport",
            selector: `${uniqueSelector(frameElement)} >>> :viewport`,
            scrollLeft: Math.round(view.scrollX),
            scrollTop: Math.round(view.scrollY),
          });
        }

        current = frameElement;
      }

      return contexts;
    }

    function isScrollableElement(node: HTMLElement): boolean {
      const view = node.ownerDocument.defaultView;
      const styles = view?.getComputedStyle(node) ?? getComputedStyle(node);
      const scrollsX = /(auto|scroll|overlay|hidden|clip)/.test(styles.overflowX) && node.scrollWidth > node.clientWidth;
      const scrollsY = /(auto|scroll|overlay|hidden|clip)/.test(styles.overflowY) && node.scrollHeight > node.clientHeight;
      return scrollsX || scrollsY;
    }

    function composedParent(node: Element): Element | null {
      if (node.parentElement) return node.parentElement;
      const root = node.getRootNode();
      return isShadowRoot(root) ? root.host : null;
    }

    function isHtmlElement(node: Element): node is HTMLElement {
      return node.namespaceURI === "http://www.w3.org/1999/xhtml";
    }

    function isShadowRoot(root: Node): root is ShadowRoot {
      return root.nodeType === Node.DOCUMENT_FRAGMENT_NODE && "host" in root;
    }

    function uniqueSelector(node: Element): string {
      const root = node.getRootNode();
      const prefix = isShadowRoot(root)
        ? `${uniqueSelector(root.host)} >>> `
        : node.ownerDocument !== document && node.ownerDocument.defaultView?.frameElement
          ? `${uniqueSelector(node.ownerDocument.defaultView.frameElement)} >>> `
          : "";
      if (node.id) return `${prefix}#${CSS.escape(node.id)}`;
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
      return `${prefix}${parts.join(" > ")}`;
    }
  }, {
    stepIndex: index,
    computedName: accessibleName.slice(0, 160),
    accessibilityRole: computedRole,
    identity: elementIdentity,
    nodeId: backendNodeId,
    geometry: observedGeometry,
  });
}

async function readNodeGeometry(cdp: CDPSession, backendNodeId: number): Promise<NodeGeometry | null> {
  if (!backendNodeId) return null;
  try {
    const { model } = await cdp.send("DOM.getBoxModel", { backendNodeId });
    const quad = model.border.map((value) => Math.round(value * 100) / 100);
    if (quad.length !== 8 || quad.some((value) => !Number.isFinite(value))) return null;
    const xs = [quad[0]!, quad[2]!, quad[4]!, quad[6]!];
    const ys = [quad[1]!, quad[3]!, quad[5]!, quad[7]!];
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const right = Math.max(...xs);
    const bottom = Math.max(...ys);
    return {
      quad,
      rect: {
        x: left,
        y: top,
        width: Math.round((right - left) * 100) / 100,
        height: Math.round((bottom - top) * 100) / 100,
      },
    };
  } catch {
    return null;
  }
}

function classifyVisualEvidence(
  step: FocusStep,
  capture: { width: number; height: number },
  geometryAvailable: boolean,
): VisualEvidence {
  if ((step.scrollContexts?.length ?? 0) > 0 || step.scrollContext) {
    return { status: "sequence-only", reason: "scroll-or-clipping-context" };
  }
  if (!geometryAvailable) return { status: "sequence-only", reason: "geometry-unavailable" };

  const left = step.rect.x;
  const top = step.rect.y;
  const right = left + step.rect.width;
  const bottom = top + step.rect.height;
  if (right <= 0 || bottom <= 0 || left >= capture.width || top >= capture.height) return { status: "outside-capture" };
  if (left < 0 || top < 0 || right > capture.width || bottom > capture.height) return { status: "partially-visible" };
  return { status: "plotted" };
}

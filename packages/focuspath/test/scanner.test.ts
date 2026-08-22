import { describe, expect, it } from "vitest";
import { ScanTimeoutError, scanFocusPath } from "../src/scanner.js";

function page(markup: string): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(markup)}`;
}

describe("focus scanner", () => {
  it("traverses focus in reverse with Shift+Tab", async () => {
    const report = await scanFocusPath(page(`<button>First</button><button>Second</button><button>Third</button>`), {
      direction: "reverse",
      focusSettleMs: 0,
    });
    expect(report.version).toBe(3);
    expect(report.direction).toBe("reverse");
    expect(report.steps.map((step) => step.accessibleName)).toEqual(["Third", "Second", "First"]);
    expect(report.tabPressCount).toBe(4);
    expect(report.stoppedBecause).toBe("document-exhausted");
  });

  it("uses Chromium's computed accessible name", async () => {
    const report = await scanFocusPath(page(`<button><img src="x" alt="Save"></button>`), { focusSettleMs: 0 });
    expect(report.direction).toBe("forward");
    expect(report.steps[0]?.accessibleName).toBe("Save");
    expect(report.issues).not.toContainEqual(expect.objectContaining({ kind: "missing-name" }));
  });

  it("distinguishes the end of the document from stalled focus", async () => {
    const complete = await scanFocusPath(page(`<button>One</button><a href="#">Two</a>`), { focusSettleMs: 0 });
    expect(complete.steps.map((step) => step.accessibleName)).toEqual(["One", "Two"]);
    expect(complete.stoppedBecause).toBe("document-exhausted");
    expect(complete.issues).not.toContainEqual(expect.objectContaining({ kind: "focus-stalled" }));

    const stalled = await scanFocusPath(page(`<button>Only</button><script>document.addEventListener('keydown',event=>{if(event.key==='Tab'&&document.activeElement.tagName==='BUTTON')event.preventDefault()})</script>`), { focusSettleMs: 0 });
    expect(stalled.stoppedBecause).toBe("stalled-on-element");
    expect(stalled.issues).toContainEqual(expect.objectContaining({ kind: "focus-stalled", step: 1 }));
  });

  it.each([
    ["forward", ["First branch", "Second branch", "After both"]],
    ["reverse", ["After both", "Second branch", "First branch"]],
  ] as const)("uses DOM identity instead of a truncated selector during %s traversal", async (direction, expectedNames) => {
    const branch = (label: string) => `<section><div><div><div><div><div><button>${label}</button></div></div></div></div></div></section>`;
    const report = await scanFocusPath(page(`${branch("First branch")}${branch("Second branch")}<a href="#after">After both</a>`), { direction, focusSettleMs: 0 });

    expect(report.steps.map((step) => step.accessibleName)).toEqual(expectedNames);
    const branchSteps = report.steps.filter((step) => step.accessibleName.endsWith("branch"));
    expect(branchSteps[0]?.selector).toBe(branchSteps[1]?.selector);
    expect(report.issues).not.toContainEqual(expect.objectContaining({ kind: "focus-stalled" }));
    expect(report.stoppedBecause).toBe("document-exhausted");
  });

  it("applies the timeout to the complete scan", async () => {
    await expect(scanFocusPath(page(`<button>One</button><button>Two</button>`), {
      focusSettleMs: 500,
      timeoutMs: 100,
    })).rejects.toBeInstanceOf(ScanTimeoutError);
  });

  it("reports a generic role separately from a missing name", async () => {
    const report = await scanFocusPath(page(`<div tabindex="0">Focusable content</div>`), { focusSettleMs: 0 });
    expect(report.issues).toContainEqual(expect.objectContaining({ kind: "missing-or-generic-role", severity: "warning" }));
    expect(report.issues).not.toContainEqual(expect.objectContaining({ kind: "missing-name" }));
  });

  it("follows focus into an open shadow root", async () => {
    const report = await scanFocusPath(page(`<focus-card></focus-card><script>
      const root = document.querySelector('focus-card').attachShadow({mode:'open'});
      root.innerHTML = '<button id="save">Save draft</button>';
    </script>`), { focusSettleMs: 0 });
    expect(report.steps[0]).toMatchObject({ accessibleName: "Save draft", role: "button" });
    expect(report.steps[0]?.selector).toContain(">>> #save");
  });

  it("follows focus into a same-origin iframe", async () => {
    const report = await scanFocusPath(page(`<iframe title="Editor" srcdoc='<button id="publish">Publish</button>'></iframe>`), { focusSettleMs: 0 });
    expect(report.steps[0]).toMatchObject({ accessibleName: "Publish", role: "button" });
    expect(report.steps[0]?.selector).toContain("iframe >>> #publish");
  });

  it("keeps fixed elements at their screenshot position after scrolling", async () => {
    const report = await scanFocusPath(page(`<a href="#" style="display:block;margin-top:1400px">Deep link</a><button id="fixed" style="position:fixed;top:12px;left:14px">Fixed</button>`), {
      focusSettleMs: 0,
      viewport: { width: 800, height: 500 },
    });
    const fixed = report.steps.find((step) => step.selector === "#fixed");
    expect(fixed?.rect).toMatchObject({ x: 14, y: 12 });
  });

  it("remeasures sticky elements in the final screenshot state during reverse traversal", async () => {
    const report = await scanFocusPath(page(`<style>body{margin:0}.sticky{position:sticky;top:0}.spacer{height:1400px}</style><button id="sticky" class="sticky">Sticky</button><div class="spacer"></div><button>Last</button>`), {
      direction: "reverse",
      focusSettleMs: 0,
      viewport: { width: 800, height: 500 },
    });

    const sticky = report.steps.find((step) => step.selector === "#sticky");
    expect(sticky?.rect.y).toBe(0);
    expect(sticky?.visualEvidence).toEqual({ status: "plotted" });
  });

  it("interrupts smooth focus scrolling before final screenshot geometry is measured", async () => {
    const report = await scanFocusPath(page(`<style>html{scroll-behavior:smooth}body{margin:8px}</style><button>First</button><div style="height:4000px"></div><button>Last</button>`), {
      focusSettleMs: 0,
      viewport: { width: 390, height: 844 },
    });

    expect(report.steps[0]).toMatchObject({
      accessibleName: "First",
      rect: { y: 8 },
      visualEvidence: { status: "plotted" },
    });
    expect(report.steps[1]).toMatchObject({
      accessibleName: "Last",
      visualEvidence: { status: "plotted" },
    });
    expect(report.document.height).toBeGreaterThan(4_000);
  });

  it("caps beyond-viewport evidence at the configured screenshot budget", async () => {
    const report = await scanFocusPath(page(`<button>First</button><div style="height:7000px"></div><button>Last</button>`), {
      focusSettleMs: 0,
      viewport: { width: 390, height: 844 },
      maxScreenshotHeight: 5_000,
    });

    expect(report.document.height).toBe(5_000);
    expect(report.steps[0]?.visualEvidence).toEqual({ status: "plotted" });
    expect(report.steps[1]?.visualEvidence).toEqual({ status: "outside-capture" });
  });

  it.each(["forward", "reverse"] as const)("uses transformed iframe quads during %s traversal", async (direction) => {
    const report = await scanFocusPath(page(`<iframe id="frame" title="Transformed" style="width:400px;height:160px;transform:scale(.5) rotate(4deg);transform-origin:0 0" srcdoc='<button id="inside" style="width:100px;height:40px">Inside</button>'></iframe>`), {
      direction,
      focusSettleMs: 0,
      viewport: { width: 800, height: 500 },
    });

    const inside = report.steps.find((step) => step.selector.includes("#inside"));
    expect(inside?.quad).toHaveLength(8);
    expect(inside?.rect.width).toBeLessThan(60);
    expect(inside?.rect.height).toBeLessThan(30);
    expect(inside?.visualEvidence).toEqual({ status: "plotted" });
  });

  it("reports the actual captured pixels when root scrolling is locked", async () => {
    const report = await scanFocusPath(page(`<style>html,body{height:1600px;overflow:hidden}</style><button style="position:absolute;top:1400px">Deep control</button>`), {
      focusSettleMs: 0,
      viewport: { width: 800, height: 500 },
    });

    expect(report.document).toEqual({ width: 800, height: 1608 });
    expect(report.steps[0]?.visualEvidence).toEqual({ status: "plotted" });
  });

  it("marks focus stops inside scroll containers as sequence-only evidence", async () => {
    const controls = Array.from({ length: 5 }, (_, index) => `<button style="display:block;height:70px">Control ${index + 1}</button>`).join("");
    const report = await scanFocusPath(page(`<div id="scroller" style="height:120px;overflow:auto">${controls}</div><a href="#after">After</a>`), {
      focusSettleMs: 0,
      viewport: { width: 800, height: 500 },
    });

    const scrolledSteps = report.steps.slice(0, 5);
    expect(scrolledSteps).toHaveLength(5);
    expect(scrolledSteps.some((step) => step.scrollContext?.selector === "#scroller")).toBe(true);
    expect(scrolledSteps.some((step) => (step.scrollContext?.scrollTop ?? 0) > 0)).toBe(true);
    expect(report.steps.at(-1)?.scrollContext).toBeUndefined();
  });

  it.each(["forward", "reverse"] as const)("treats overflow hidden as sequence-only evidence during %s traversal", async (direction) => {
    const controls = Array.from({ length: 5 }, (_, index) => `<button style="display:block;height:70px">Hidden ${index + 1}</button>`).join("");
    const report = await scanFocusPath(page(`<div id="clipper" style="height:120px;overflow:hidden">${controls}</div><a href="#after">After</a>`), {
      direction,
      focusSettleMs: 0,
      viewport: { width: 800, height: 500 },
    });

    const hiddenSteps = report.steps.filter((step) => step.accessibleName.startsWith("Hidden"));
    expect(hiddenSteps).toHaveLength(5);
    expect(hiddenSteps.some((step) => step.scrollContexts?.some((context) => context.selector === "#clipper"))).toBe(true);
    expect(hiddenSteps.some((step) => step.visualEvidence?.status === "sequence-only")).toBe(true);
  });

  it("keeps visible controls plottable when only decoration overflows a hidden ancestor", async () => {
    const report = await scanFocusPath(page(`<section id="hero" style="position:relative;width:390px;overflow:hidden"><div aria-hidden="true" style="position:absolute;width:410px;height:10px"></div><button style="margin:40px">Copy</button></section>`), {
      focusSettleMs: 0,
      viewport: { width: 390, height: 844 },
    });

    expect(report.steps[0]?.scrollContexts).toBeUndefined();
    expect(report.steps[0]?.visualEvidence).toEqual({ status: "plotted" });
  });

  it("treats overflow clip as a clipping context", async () => {
    const report = await scanFocusPath(page(`<div id="clipper" style="height:50px;overflow:clip"><button style="margin-top:70px">Clipped</button></div>`), {
      focusSettleMs: 0,
      viewport: { width: 800, height: 500 },
    });

    expect(report.steps[0]?.scrollContexts).toContainEqual(expect.objectContaining({ selector: "#clipper" }));
    expect(report.steps[0]?.visualEvidence).toEqual({ status: "sequence-only", reason: "scroll-or-clipping-context" });
  });

  it.each(["forward", "reverse"] as const)("records the nested iframe viewport during %s traversal", async (direction) => {
    const controls = Array.from({ length: 5 }, (_, index) => `<button style="display:block;height:100px">Frame ${index + 1}</button>`).join("");
    const report = await scanFocusPath(page(`<iframe id="frame" title="Scrollable frame" style="width:320px;height:120px" srcdoc='${controls}'></iframe><a href="#after">After</a>`), {
      direction,
      focusSettleMs: 0,
      viewport: { width: 800, height: 500 },
    });

    const frameSteps = report.steps.filter((step) => step.accessibleName.startsWith("Frame"));
    expect(frameSteps).toHaveLength(5);
    for (const step of frameSteps) {
      expect(step.scrollContexts).toContainEqual(expect.objectContaining({
        kind: "viewport",
        selector: "#frame >>> :viewport",
      }));
    }
    expect(frameSteps.some((step) => step.scrollContexts?.some((context) => context.scrollTop > 0))).toBe(true);
  });

  it.each(["forward", "reverse"] as const)("finds a parent scroller outside an iframe during %s traversal", async (direction) => {
    const controls = Array.from({ length: 4 }, (_, index) => `<button style="display:block;height:90px">Frame ${index + 1}</button>`).join("");
    const report = await scanFocusPath(page(`<div id="outer" style="width:360px;height:120px;overflow:auto"><iframe id="frame" title="Nested frame" style="display:block;width:320px;height:420px" srcdoc='${controls}'></iframe></div><a href="#after">After</a>`), {
      direction,
      focusSettleMs: 0,
      viewport: { width: 800, height: 500 },
    });

    const frameSteps = report.steps.filter((step) => step.accessibleName.startsWith("Frame"));
    expect(frameSteps).toHaveLength(4);
    for (const step of frameSteps) {
      expect(step.scrollContexts).toContainEqual(expect.objectContaining({ kind: "element", selector: "#outer" }));
      expect(step.scrollContexts).not.toContainEqual(expect.objectContaining({ kind: "viewport" }));
    }
    expect(frameSteps.some((step) => step.scrollContexts?.some((context) => context.selector === "#outer" && context.scrollTop > 0))).toBe(true);
  });

  it.each(["forward", "reverse"] as const)("records iframe and parent scroll contexts together during %s traversal", async (direction) => {
    const controls = Array.from({ length: 5 }, (_, index) => `<button style="display:block;height:100px">Frame ${index + 1}</button>`).join("");
    const report = await scanFocusPath(page(`<div id="outer" style="width:360px;height:80px;overflow:auto"><iframe id="frame" title="Nested scrollable frame" style="display:block;width:320px;height:120px" srcdoc='${controls}'></iframe></div><a href="#after">After</a>`), {
      direction,
      focusSettleMs: 0,
      viewport: { width: 800, height: 500 },
    });

    const frameSteps = report.steps.filter((step) => step.accessibleName.startsWith("Frame"));
    expect(frameSteps).toHaveLength(5);
    for (const step of frameSteps) {
      expect(step.scrollContexts?.map((context) => [context.kind, context.selector])).toEqual([
        ["viewport", "#frame >>> :viewport"],
        ["element", "#outer"],
      ]);
      expect(step.scrollContext).toEqual(step.scrollContexts?.[0]);
    }
  });

  it("handles elements removed while traversal is in progress", async () => {
    const report = await scanFocusPath(page(`<button id="one">One</button><button id="two">Two</button><button id="three">Three</button><script>
      one.addEventListener('focus', () => two.remove());
    </script>`), { focusSettleMs: 0 });
    expect(report.steps.map((step) => step.accessibleName)).toEqual(["One", "Three"]);
    expect(report.stoppedBecause).toBe("document-exhausted");
  });

  it("continues beyond multiple controls in a closed shadow root", async () => {
    const report = await scanFocusPath(page(`<button>Before</button><secret-control></secret-control><a href="#after">After</a><script>
      const root = document.querySelector('secret-control').attachShadow({mode:'closed'});
      root.innerHTML = '<button>Private one</button><button>Private two</button>';
    </script>`), { focusSettleMs: 0 });
    expect(report.steps.map((step) => step.accessibleName)).toEqual(["Before", "", "After"]);
    expect(report.issues).toContainEqual(expect.objectContaining({ kind: "opaque-focus-host", selector: "body > secret-control" }));
    expect(report.issues).toContainEqual(expect.objectContaining({ kind: "missing-or-generic-role", selector: "body > secret-control" }));
    expect(report.issues).not.toContainEqual(expect.objectContaining({ kind: "focus-stalled" }));
    expect(report.stoppedBecause).toBe("document-exhausted");
  });

  it("continues beyond multiple controls in a cross-origin iframe", async () => {
    const frame = page(`<button>Frame one</button><button>Frame two</button>`);
    const report = await scanFocusPath(page(`<button>Before</button><iframe title="External tools" src="${frame}"></iframe><a href="#after">After</a>`), { focusSettleMs: 0 });
    expect(report.steps.map((step) => step.accessibleName)).toEqual(["Before", "External tools", "After"]);
    expect(report.issues).toContainEqual(expect.objectContaining({ kind: "opaque-focus-host", selector: "body > iframe" }));
    expect(report.issues).not.toContainEqual(expect.objectContaining({ kind: "focus-stalled" }));
    expect(report.stoppedBecause).toBe("document-exhausted");
  });

  it("bounds traversal when focus cannot leave an opaque host", async () => {
    const report = await scanFocusPath(page(`<secret-control></secret-control><script>
      const host = document.querySelector('secret-control');
      const root = host.attachShadow({mode:'closed'});
      root.innerHTML = '<button>Private one</button><button>Private two</button><button>Private three</button><button>Private four</button><button>Private five</button>';
    </script>`), { focusSettleMs: 0, maxOpaqueTabPresses: 3 });
    expect(report.steps).toHaveLength(1);
    expect(report.issues).toContainEqual(expect.objectContaining({ kind: "opaque-focus-host" }));
    expect(report.issues).toContainEqual(expect.objectContaining({ kind: "opaque-host-limit", step: 1 }));
    expect(report.stoppedBecause).toBe("opaque-host-limit");
    expect(report.tabPressCount).toBe(4);
    expect(report.limits.maxOpaqueTabPresses).toBe(3);
  });

  it("does not classify an ordinary focusable custom element as opaque", async () => {
    const report = await scanFocusPath(page(`<user-chip tabindex="3">Profile</user-chip><button>After</button>`), { focusSettleMs: 0 });
    expect(report.issues).toContainEqual(expect.objectContaining({ kind: "positive-tabindex", selector: "body > user-chip" }));
    expect(report.issues).toContainEqual(expect.objectContaining({ kind: "missing-or-generic-role", selector: "body > user-chip" }));
    expect(report.issues).not.toContainEqual(expect.objectContaining({ kind: "opaque-focus-host" }));
  });

  it("reports a custom element that cancels Tab as stalled focus", async () => {
    const report = await scanFocusPath(page(`<user-chip tabindex="0">Profile</user-chip><button>After</button><script>
      document.querySelector('user-chip').addEventListener('keydown', event => {
        if (event.key === 'Tab') event.preventDefault();
      });
    </script>`), { focusSettleMs: 0, maxOpaqueTabPresses: 3 });
    expect(report.steps).toHaveLength(1);
    expect(report.issues).toContainEqual(expect.objectContaining({ kind: "missing-or-generic-role", step: 1 }));
    expect(report.issues).toContainEqual(expect.objectContaining({ kind: "focus-stalled", step: 1 }));
    expect(report.issues).not.toContainEqual(expect.objectContaining({ kind: "opaque-focus-host" }));
    expect(report.issues).not.toContainEqual(expect.objectContaining({ kind: "opaque-host-limit" }));
    expect(report.stoppedBecause).toBe("stalled-on-element");
    expect(report.tabPressCount).toBe(2);
  });

  it("observes Tab cancellation before page capture listeners can stop propagation", async () => {
    const report = await scanFocusPath(page(`<user-chip tabindex="0">Profile</user-chip><button>After</button><script>
      window.addEventListener('keydown', event => {
        if (event.key !== 'Tab' || document.activeElement?.tagName !== 'USER-CHIP') return;
        event.preventDefault();
        event.stopImmediatePropagation();
      }, { capture: true });
    </script>`), { focusSettleMs: 0, maxOpaqueTabPresses: 3 });
    expect(report.steps).toHaveLength(1);
    expect(report.issues).toContainEqual(expect.objectContaining({ kind: "focus-stalled", step: 1 }));
    expect(report.issues).not.toContainEqual(expect.objectContaining({ kind: "opaque-focus-host" }));
    expect(report.issues).not.toContainEqual(expect.objectContaining({ kind: "opaque-host-limit" }));
    expect(report.stoppedBecause).toBe("stalled-on-element");
    expect(report.tabPressCount).toBe(2);
  });

  it("detects canceled Shift+Tab during reverse traversal", async () => {
    const report = await scanFocusPath(page(`<button>Before</button><user-chip tabindex="0">Profile</user-chip><script>
      window.addEventListener('keydown', event => {
        if (event.key !== 'Tab' || !event.shiftKey || document.activeElement?.tagName !== 'USER-CHIP') return;
        event.preventDefault();
        event.stopImmediatePropagation();
      }, { capture: true });
    </script>`), { direction: "reverse", focusSettleMs: 0 });
    expect(report.steps.map((step) => step.tagName)).toEqual(["user-chip"]);
    expect(report.issues).toContainEqual(expect.objectContaining({ kind: "focus-stalled", step: 1 }));
    expect(report.issues).not.toContainEqual(expect.objectContaining({ kind: "opaque-focus-host" }));
    expect(report.direction).toBe("reverse");
    expect(report.stoppedBecause).toBe("stalled-on-element");
  });

  it("traverses positive tabindex controls in Chromium reverse order", async () => {
    const report = await scanFocusPath(page(`<button tabindex="2">Second positive</button><button tabindex="1">First positive</button><button>Natural</button>`), {
      direction: "reverse",
      focusSettleMs: 0,
    });
    expect(report.steps.map((step) => step.accessibleName)).toEqual(["Natural", "Second positive", "First positive"]);
    expect(report.issues.filter((issue) => issue.kind === "positive-tabindex")).toHaveLength(2);
  });

  it("traverses an open shadow root in reverse", async () => {
    const report = await scanFocusPath(page(`<button>Before</button><focus-card></focus-card><script>
      const root = document.querySelector('focus-card').attachShadow({mode:'open'});
      root.innerHTML = '<button>Shadow first</button><button>Shadow second</button>';
    </script>`), { direction: "reverse", focusSettleMs: 0 });
    expect(report.steps.map((step) => step.accessibleName)).toEqual(["Shadow second", "Shadow first", "Before"]);
  });

  it("continues beyond a closed shadow root in reverse", async () => {
    const report = await scanFocusPath(page(`<button>Before</button><secret-control></secret-control><a href="#after">After</a><script>
      const root = document.querySelector('secret-control').attachShadow({mode:'closed'});
      root.innerHTML = '<button>Private first</button><button>Private second</button>';
    </script>`), { direction: "reverse", focusSettleMs: 0 });
    expect(report.steps.map((step) => step.accessibleName)).toEqual(["After", "", "Before"]);
    expect(report.issues).toContainEqual(expect.objectContaining({ kind: "opaque-focus-host" }));
    expect(report.issues).not.toContainEqual(expect.objectContaining({ kind: "focus-stalled" }));
  });

  it("traverses a same-origin iframe in reverse", async () => {
    const report = await scanFocusPath(page(`<button>Before</button><iframe title="Editor" srcdoc='<button>Frame first</button><button>Frame second</button>'></iframe><a href="#after">After</a>`), {
      direction: "reverse",
      focusSettleMs: 0,
    });
    expect(report.steps.map((step) => step.accessibleName)).toEqual(["After", "Frame second", "Frame first", "Before"]);
  });

  it("continues beyond a cross-origin iframe in reverse", async () => {
    const frame = page(`<button>Frame first</button><button>Frame second</button>`);
    const report = await scanFocusPath(page(`<button>Before</button><iframe title="External tools" src="${frame}"></iframe><a href="#after">After</a>`), {
      direction: "reverse",
      focusSettleMs: 0,
    });
    expect(report.steps.map((step) => step.accessibleName)).toEqual(["After", "External tools", "Before"]);
    expect(report.issues).toContainEqual(expect.objectContaining({ kind: "opaque-focus-host" }));
    expect(report.issues).not.toContainEqual(expect.objectContaining({ kind: "focus-stalled" }));
  });

  it("continues beyond a cross-origin iframe with more than twenty controls", async () => {
    const controls = Array.from({ length: 21 }, (_, index) => `<button>Frame ${index + 1}</button>`).join("");
    const frame = page(controls);
    const report = await scanFocusPath(page(`<button>Before</button><iframe title="Large widget" src="${frame}"></iframe><a href="#after">After</a>`), { focusSettleMs: 0 });
    expect(report.steps.map((step) => step.accessibleName)).toEqual(["Before", "Large widget", "After"]);
    expect(report.issues).not.toContainEqual(expect.objectContaining({ kind: "opaque-host-limit" }));
    expect(report.tabPressCount).toBeGreaterThan(report.steps.length);
    expect(report.stoppedBecause).toBe("document-exhausted");
  });

  it("counts all Tab presses and exposes a separate total traversal limit", async () => {
    const frame = page(Array.from({ length: 10 }, (_, index) => `<button>Frame ${index + 1}</button>`).join(""));
    const report = await scanFocusPath(page(`<button>Before</button><iframe title="Large widget" src="${frame}"></iframe><a href="#after">After</a>`), {
      focusSettleMs: 0,
      maxSteps: 10,
      maxTabPresses: 5,
    });
    expect(report.steps.map((step) => step.accessibleName)).toEqual(["Before", "Large widget"]);
    expect(report.tabPressCount).toBe(5);
    expect(report.limits).toEqual({ maxSteps: 10, maxTabPresses: 5, maxOpaqueTabPresses: 100 });
    expect(report.stoppedBecause).toBe("tab-press-limit");
  });

  it("traverses controls in an open dialog", async () => {
    const report = await scanFocusPath(page(`<dialog open><button>Cancel</button><button>Confirm</button></dialog>`), { focusSettleMs: 0 });
    expect(report.steps.map((step) => step.accessibleName)).toEqual(["Cancel", "Confirm"]);
  });

  it("applies the URL policy to subresources before download", async () => {
    const checked: string[] = [];
    const report = await scanFocusPath(page(`<button>Ready</button><img src="https://example.com/tracker.png">`), {
      focusSettleMs: 0,
      isUrlAllowed: (url) => {
        checked.push(url);
        return !url.endsWith("/tracker.png");
      },
    });
    expect(checked).toContain("https://example.com/tracker.png");
    expect(report.steps[0]?.accessibleName).toBe("Ready");
    expect(report.network).toMatchObject({ requestCount: 1, blockedRequestCount: 1, blockedResourceTypes: [] });
  });
});

import { describe, expect, it } from "vitest";
import { ScanTimeoutError, scanFocusPath } from "../src/scanner.js";

function page(markup: string): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(markup)}`;
}

describe("focus scanner", () => {
  it("uses Chromium's computed accessible name", async () => {
    const report = await scanFocusPath(page(`<button><img src="x" alt="Save"></button>`), { focusSettleMs: 0 });
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
    expect(stalled.issues).toContainEqual(expect.objectContaining({ kind: "focus-stalled" }));
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

  it("handles elements removed while traversal is in progress", async () => {
    const report = await scanFocusPath(page(`<button id="one">One</button><button id="two">Two</button><button id="three">Three</button><script>
      one.addEventListener('focus', () => two.remove());
    </script>`), { focusSettleMs: 0 });
    expect(report.steps.map((step) => step.accessibleName)).toEqual(["One", "Three"]);
    expect(report.stoppedBecause).toBe("document-exhausted");
  });

  it("handles a closed shadow root as an intentionally opaque focus host", async () => {
    const report = await scanFocusPath(page(`<secret-control></secret-control><script>
      const root = document.querySelector('secret-control').attachShadow({mode:'closed'});
      root.innerHTML = '<button>Private action</button>';
    </script>`), { focusSettleMs: 0 });
    expect(report.steps).toHaveLength(1);
    expect(report.steps[0]?.selector).toBe("body > secret-control");
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
  });
});

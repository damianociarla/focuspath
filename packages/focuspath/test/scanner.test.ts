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
});

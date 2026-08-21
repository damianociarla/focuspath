import { describe, expect, it } from "vitest";
import { escapeHtml, generateHtmlReport } from "../src/reporter.js";
import type { FocusReport } from "../src/types.js";

describe("reporter", () => {
  it("escapes untrusted page content", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });

  it("renders focus nodes and issues", () => {
    const report: FocusReport = {
      version: 2,
      direction: "reverse",
      url: "https://example.com/",
      title: "Example",
      scannedAt: "2026-08-20T00:00:00.000Z",
      durationMs: 120,
      tabPressCount: 2,
      limits: { maxSteps: 50, maxTabPresses: 200, maxOpaqueTabPresses: 100 },
      viewport: { width: 1000, height: 700 },
      document: { width: 1000, height: 1200 },
      screenshot: "data:image/jpeg;base64,test",
      stoppedBecause: "cycle-complete",
      steps: [{ index: 1, selector: "button", tagName: "button", role: "button", accessibleName: "", tabIndex: 0, href: null, rect: { x: 20, y: 30, width: 100, height: 40 }, focusIndicator: { outline: "2px solid black", boxShadow: "none" } }],
      issues: [{ kind: "missing-name", severity: "error", step: 1, selector: "button", message: "Focusable control has no computed accessible name." }],
    };

    const html = generateHtmlReport(report);
    expect(html).toContain("FocusPath / Report");
    expect(html).toContain("Focusable control has no computed accessible name.");
    expect(html).toContain("<circle cx=\"70\" cy=\"50\"");
    expect(html).toContain("Skip visual overview");
    expect(html).toContain("<caption class=\"sr-only\">Focus stops in reverse keyboard traversal order</caption>");
    expect(html).toContain("<th scope=\"row\">1</th>");
    expect(html).toContain("aria-hidden=\"true\" focusable=\"false\"");
    expect(html).toContain("<dt>Tab presses</dt><dd>2</dd>");
    expect(html).toContain("<dt>direction</dt><dd>reverse</dd>");
    expect(html).toContain("limits: 50 stops / 200 Tab presses / 100 per opaque host");
  });

  it("does not place scroll-container steps over a different screenshot state", () => {
    const report: FocusReport = {
      version: 2,
      direction: "forward",
      url: "https://example.com/",
      title: "Scrollable controls",
      scannedAt: "2026-08-21T00:00:00.000Z",
      durationMs: 80,
      tabPressCount: 2,
      limits: { maxSteps: 50, maxTabPresses: 200, maxOpaqueTabPresses: 100 },
      viewport: { width: 800, height: 500 },
      document: { width: 800, height: 500 },
      screenshot: "data:image/jpeg;base64,test",
      stoppedBecause: "document-exhausted",
      steps: [{
        index: 1,
        selector: "#scroller > button:nth-of-type(1)",
        tagName: "button",
        role: "button",
        accessibleName: "One",
        tabIndex: 0,
        href: null,
        rect: { x: 20, y: 30, width: 100, height: 40 },
        focusIndicator: { outline: "2px solid black", boxShadow: "none" },
        scrollContext: { selector: "#scroller", scrollLeft: 0, scrollTop: 70 },
      }],
      issues: [],
    };

    const html = generateHtmlReport(report);
    expect(html).not.toContain("<g class=\"focus-node\">");
    expect(html).toContain("<strong>1 step is sequence-only.</strong>");
    expect(html).toContain("Sequence only — inside #scroller at scroll 0, 70");
    expect(html).toContain("<th scope=\"col\">Visual evidence</th>");
  });
});

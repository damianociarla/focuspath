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
      capture: { sourceWidth: 1000, sourceHeight: 2400, truncated: true },
      network: { requestCount: 12, blockedRequestCount: 3, blockedResourceTypes: ["font", "media"] },
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
    expect(html).toContain("Rendered with network restrictions.");
    expect(html).toContain("3 requests were blocked");
    expect(html).toContain("Screenshot capture was truncated.");
    expect(html).toContain("1200px of a 2400px document");
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
    expect(html).toContain("<strong>1 step is omitted from the overlay.</strong>");
    expect(html).toContain("Sequence only — element #scroller at scroll 0, 70");
    expect(html).toContain("<th scope=\"col\">Visual evidence</th>");

    report.steps[0]!.scrollContexts = [
      { kind: "viewport", selector: "#frame >>> :viewport", scrollLeft: 0, scrollTop: 140 },
      { kind: "element", selector: "#outer", scrollLeft: 0, scrollTop: 40 },
    ];
    const nestedHtml = generateHtmlReport(report);
    expect(nestedHtml).toContain("viewport #frame &gt;&gt;&gt; :viewport at scroll 0, 140; element #outer at scroll 0, 40");
    expect(nestedHtml).not.toContain("<g class=\"focus-node\">");
  });

  it("does not extend the overlay beyond the pixels in the screenshot", () => {
    const report: FocusReport = {
      version: 2,
      direction: "forward",
      url: "https://example.com/",
      title: "Scroll locked page",
      scannedAt: "2026-08-21T00:00:00.000Z",
      durationMs: 80,
      tabPressCount: 2,
      limits: { maxSteps: 50, maxTabPresses: 200, maxOpaqueTabPresses: 100 },
      viewport: { width: 800, height: 500 },
      document: { width: 800, height: 500 },
      screenshot: "data:image/jpeg;base64,test",
      stoppedBecause: "document-exhausted",
      steps: [
        { index: 1, selector: "#visible", tagName: "button", role: "button", accessibleName: "Visible", tabIndex: 0, href: null, rect: { x: 20, y: 30, width: 100, height: 40 }, focusIndicator: { outline: "2px solid black", boxShadow: "none" } },
        { index: 2, selector: "#deep", tagName: "button", role: "button", accessibleName: "Deep", tabIndex: 0, href: null, rect: { x: 20, y: 900, width: 100, height: 40 }, focusIndicator: { outline: "2px solid black", boxShadow: "none" } },
      ],
      issues: [],
    };

    const html = generateHtmlReport(report);
    expect(html.match(/<g class="focus-node">/g)).toHaveLength(1);
    expect(html).not.toContain("y2=\"920\"");
    expect(html).toContain("Outside captured screenshot");
    expect(html).toContain("<strong>1 step is omitted from the overlay.</strong>");
  });

  it("renders transformed geometry as a polygon", () => {
    const report: FocusReport = {
      version: 2,
      direction: "forward",
      url: "https://example.com/",
      title: "Transformed frame",
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
        selector: "#frame >>> #inside",
        tagName: "button",
        role: "button",
        accessibleName: "Inside",
        tabIndex: 0,
        href: null,
        rect: { x: 10, y: 10, width: 55, height: 30 },
        quad: [10, 10, 60, 14, 58, 34, 8, 30],
        visualEvidence: { status: "plotted" },
        focusIndicator: { outline: "2px solid black", boxShadow: "none" },
      }],
      issues: [],
    };

    const html = generateHtmlReport(report);
    expect(html).toContain('<polygon points="10,10 60,14 58,34 8,30"/>');
    expect(html).not.toContain("<rect x=\"10\"");
  });
});

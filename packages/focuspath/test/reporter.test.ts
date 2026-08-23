import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { escapeHtml, generateHtmlReport } from "../src/reporter.js";
import type { FocusReport } from "../src/types.js";

function pngDataUrl(width: number, height: number): string {
  const signature = Buffer.from("89504e470d0a1a0a", "hex");
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  const pixels = Buffer.alloc((width + 1) * height);
  return `data:image/png;base64,${Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]).toString("base64")}`;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return chunk;
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

describe("reporter", () => {
  it("escapes untrusted page content", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });

  it("redacts embedded credentials from legacy report URLs", () => {
    const report = {
      version: 4,
      direction: "forward",
      url: "https://user:secret@example.com/private?token=query-value",
      title: "",
      scannedAt: "2026-08-23T00:00:00.000Z",
      durationMs: 1,
      tabPressCount: 0,
      limits: { maxSteps: 50, maxTabPresses: 200, maxOpaqueTabPresses: 100 },
      viewport: { width: 800, height: 600 },
      document: { width: 800, height: 600 },
      screenshot: pngDataUrl(800, 600),
      stoppedBecause: "no-focusable-elements",
      steps: [],
      issues: [],
    } satisfies FocusReport;

    const html = generateHtmlReport(report);
    expect(html).not.toContain("user");
    expect(html).not.toContain("secret");
    expect(html).toContain("https://example.com/private?token=query-value");
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
      screenshot: pngDataUrl(1000, 1200),
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
      screenshot: pngDataUrl(800, 500),
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
      screenshot: pngDataUrl(800, 500),
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
      screenshot: pngDataUrl(800, 500),
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

  it("rejects hostile saved-report values before rendering HTML, CSS, or SVG", () => {
    const base: FocusReport = {
      version: 4,
      direction: "forward",
      url: "https://example.com/",
      title: "Saved report",
      scannedAt: "2026-08-23T00:00:00.000Z",
      durationMs: 80,
      tabPressCount: 1,
      limits: { maxSteps: 50, maxTabPresses: 200, maxOpaqueTabPresses: 100 },
      viewport: { width: 800, height: 500 },
      document: { width: 800, height: 500 },
      screenshot: pngDataUrl(800, 500),
      stoppedBecause: "document-exhausted",
      steps: [{ index: 1, selector: "button", tagName: "button", role: "button", accessibleName: "Safe", tabIndex: 0, href: null, rect: { x: 20, y: 30, width: 100, height: 40 }, focusIndicator: { outline: "2px solid black", boxShadow: "none" } }],
      issues: [],
    };

    expect(() => generateHtmlReport({ ...base, direction: `forward</dd><script>alert(1)</script>` } as unknown as FocusReport)).toThrow(/direction/);
    expect(() => generateHtmlReport({ ...base, document: { ...base.document, width: `1px}</style><p>forged</p>` } } as unknown as FocusReport)).toThrow(/document\.width/);
    expect(() => generateHtmlReport({ ...base, issues: [{ kind: "missing-name", severity: `error\"><p>forged</p>`, step: 1, selector: "button", message: "message" }] } as unknown as FocusReport)).toThrow(/severity/);
    expect(() => generateHtmlReport({ ...base, screenshot: "data:image/svg+xml,<svg onload=alert(1)>" } as unknown as FocusReport)).toThrow(/screenshot/);
    expect(() => generateHtmlReport({ ...base, steps: [{ ...base.steps[0]!, rect: { ...base.steps[0]!.rect, x: Number.NaN } }] } as FocusReport)).toThrow(/rect\.x/);
  });

  it("rejects logically inconsistent saved reports", () => {
    const step = { index: 1, selector: "button", tagName: "button", role: "button", accessibleName: "Safe", tabIndex: 0, href: null, rect: { x: 20, y: 30, width: 100, height: 40 }, focusIndicator: { outline: "2px solid black", boxShadow: "none" } };
    const base: FocusReport = {
      version: 4,
      direction: "forward",
      url: "https://example.com/",
      title: "Saved report",
      scannedAt: "2026-08-23T00:00:00.000Z",
      durationMs: 80,
      tabPressCount: 1,
      limits: { maxSteps: 50, maxTabPresses: 200, maxOpaqueTabPresses: 100 },
      viewport: { width: 800, height: 500 },
      document: { width: 800, height: 500 },
      screenshot: pngDataUrl(800, 500),
      stoppedBecause: "document-exhausted",
      steps: [step],
      issues: [],
    };

    expect(() => generateHtmlReport({ ...base, tabPressCount: 201 })).toThrow(/maxTabPresses/);
    expect(() => generateHtmlReport({ ...base, tabPressCount: 0 })).toThrow(/smaller than/);
    expect(() => generateHtmlReport({ ...base, steps: [{ ...step, index: 999 }] })).toThrow(/must equal 1/);
    expect(() => generateHtmlReport({ ...base, limits: { ...base.limits, maxSteps: 1 }, tabPressCount: 2, steps: [step, { ...step, index: 2 }] })).toThrow(/maxSteps/);
    expect(() => generateHtmlReport({ ...base, issues: [{ kind: "missing-name", severity: "error", step: 2, selector: "button", message: "Forged" }] })).toThrow(/existing focus step/);
    expect(() => generateHtmlReport({ ...base, network: { requestCount: 1, blockedRequestCount: 2, blockedResourceTypes: [] } })).toThrow(/cannot exceed/);
    expect(() => generateHtmlReport({ ...base, capture: { sourceWidth: 800, sourceHeight: 500, truncated: true } })).toThrow(/truncated/);
  });

  it("rejects oversized values and forged raster evidence", () => {
    const base: FocusReport = {
      version: 4,
      direction: "forward",
      url: "https://example.com/",
      title: "Saved report",
      scannedAt: "2026-08-23T00:00:00.000Z",
      durationMs: 80,
      tabPressCount: 1,
      limits: { maxSteps: 50, maxTabPresses: 200, maxOpaqueTabPresses: 100 },
      viewport: { width: 800, height: 500 },
      document: { width: 800, height: 500 },
      screenshot: pngDataUrl(800, 500),
      stoppedBecause: "document-exhausted",
      steps: [{ index: 1, selector: "button", tagName: "button", role: "button", accessibleName: "Safe", tabIndex: 0, href: null, rect: { x: 20, y: 30, width: 100, height: 40 }, focusIndicator: { outline: "2px solid black", boxShadow: "none" } }],
      issues: [],
    };

    expect(() => generateHtmlReport({ ...base, steps: [{ ...base.steps[0]!, selector: "x".repeat(262_145) }] })).toThrow(/supported length/);
    expect(() => generateHtmlReport({ ...base, screenshot: "data:image/png;base64,AAAA" })).toThrow(/structurally valid raster image/);
    expect(() => generateHtmlReport({ ...base, screenshot: pngDataUrl(799, 500) })).toThrow(/dimensions/);
    expect(() => generateHtmlReport({ ...base, network: { requestCount: 0, blockedRequestCount: 0, blockedResourceTypes: Array.from({ length: 257 }, () => "font") } })).toThrow(/item budget/);
    expect(() => generateHtmlReport({ ...base, steps: [{ ...base.steps[0]!, scrollContexts: Array.from({ length: 129 }, () => ({ kind: "element" as const, selector: "#scroll", scrollLeft: 0, scrollTop: 1 })) }] })).toThrow(/item budget/);
    expect(() => generateHtmlReport({ ...base, tabPressCount: 10_001, limits: { ...base.limits, maxSteps: 20_000, maxTabPresses: 20_000 }, steps: Array.from({ length: 10_001 }, (_, index) => ({ ...base.steps[0]!, index: index + 1 })) })).toThrow(/item budget/);
    expect(() => generateHtmlReport({ ...base, issues: Array.from({ length: 20_001 }, () => ({ kind: "missing-name" as const, severity: "error" as const, step: 1, selector: "button", message: "Missing" })) })).toThrow(/item budget/);

    const repeatedText = "x".repeat(260_000);
    const repeatedSteps = Array.from({ length: 33 }, (_, index) => ({ ...base.steps[0]!, index: index + 1, accessibleName: repeatedText }));
    expect(() => generateHtmlReport({ ...base, tabPressCount: 33, limits: { ...base.limits, maxSteps: 50 }, steps: repeatedSteps })).toThrow(/total length/);
  });
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const css = await readFile(new URL("src/styles.css", root), "utf8");
const docs = await readFile(new URL("docs.html", root), "utf8");
const docsCss = await readFile(new URL("src/docs.css", root), "utf8");
const documentedExample = await readFile(new URL("../../packages/focuspath/test-fixtures/documented-example.ts", root), "utf8");

describe("website accessibility contract", () => {
  it("provides bypass navigation and a focusable main target", () => {
    assert.match(html, /class="skip-link" href="#top"/);
    assert.match(html, /<main id="top" tabindex="-1">/);
  });

  it("announces asynchronous scan states without making the entire result live", () => {
    assert.match(html, /data-scan-progress[^>]*role="status"[^>]*aria-live="polite"/);
    assert.match(html, /data-scan-error[^>]*role="alert"/);
    assert.match(html, /data-scan-output[^>]*aria-busy="false"/);
    assert.doesNotMatch(html, /data-scan-output[^>]*aria-live=/);
  });

  it("exposes the interactive demo selection state", () => {
    assert.match(html, /aria-controls="finding-panel"/);
    assert.match(html, /aria-pressed="true"/);
  });

  it("keeps keyboard focus visible in normal and forced-colour modes", () => {
    assert.match(css, /:focus-visible/);
    assert.match(css, /outline:\s*3px/);
    assert.match(css, /@media\s*\(forced-colors:\s*active\)/);
  });

  it("states privacy and automated-scan limitations next to the live scanner", () => {
    assert.match(html, /<summary>Privacy and scan limitations<\/summary>/);
    assert.match(html, /does not certify WCAG conformance/);
    assert.match(html, /does not intentionally persist page content or reports/);
  });

  it("documents traversal budgets, API metadata and opaque boundaries", () => {
    assert.match(docs, /--max-tab-presses/);
    assert.match(docs, /--direction/);
    assert.match(docs, /direction: "reverse"/);
    assert.match(docs, /report\.tabPressCount/);
    assert.match(docs, /custom element without an open shadow root is only treated as a candidate/);
    assert.match(docs, /OpenAPI specification/);
    assert.match(docs, /import \{ scanFocusPath, generateHtmlReport \} from "focuspath"/);
    assert.match(docs, /const html = generateHtmlReport\(report\)/);
    assert.doesNotMatch(docs, /renderHtmlReport/);
    assert.match(documentedExample, /import \{ generateHtmlReport, scanFocusPath \} from "focuspath"/);
    assert.match(documentedExample, /return generateHtmlReport\(report\)/);
    assert.match(documentedExample, /direction: "reverse"/);
  });

  it("makes the documentation page bypassable and resilient to user preferences", () => {
    assert.match(docs, /class="skip-link" href="#documentation"/);
    assert.match(docs, /<main id="documentation" tabindex="-1">/);
    assert.match(docsCss, /:focus-visible/);
    assert.match(docsCss, /@media\(prefers-reduced-motion:reduce\)/);
    assert.match(docsCss, /@media\(forced-colors:active\)/);
    assert.match(docsCss, /grid-template-columns:minmax\(0,1fr\)/);
    assert.match(docsCss, /\.contents,\.manual\{min-width:0\}/);
  });
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const css = await readFile(new URL("src/styles.css", root), "utf8");

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
});

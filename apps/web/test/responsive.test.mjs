import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, describe, it } from "node:test";
import { chromium } from "playwright";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("docs.html", root), "utf8");
const css = await readFile(new URL("src/docs.css", root), "utf8");
let browser;

before(async () => {
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
});

describe("documentation responsive layout", () => {
  it("does not overflow the 390px mobile viewport", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? "";
    await page.setContent(`<style>${css.replace(/^@import[^;]+;/, "")}</style>${body}`);
    const dimensions = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      bodyWidth: document.body.scrollWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expectNoOverflow(dimensions.innerWidth, dimensions.bodyWidth, "body");
    expectNoOverflow(dimensions.innerWidth, dimensions.documentWidth, "document");
    await page.close();
  });
});

function expectNoOverflow(viewportWidth, contentWidth, label) {
  assert.ok(contentWidth <= viewportWidth, `${label} width ${contentWidth}px exceeds viewport ${viewportWidth}px`);
}

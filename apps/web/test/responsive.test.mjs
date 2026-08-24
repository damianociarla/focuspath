import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { chromium } from "playwright";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
let browser;
let server;
let origin;

before(async () => {
  browser = await chromium.launch({ headless: true });
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? "/", "http://focuspath.test").pathname;
    const relative = normalize(pathname === "/" ? "index.html" : pathname.replace(/^\/(?:focuspath\/)?/, ""));
    const file = join(dist, relative);
    if (!file.startsWith(dist) || !(await exists(file))) {
      response.writeHead(404).end();
      return;
    }
    const contentType = {
      ".css": "text/css",
      ".html": "text/html",
      ".js": "text/javascript",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".woff2": "font/woff2",
    }[extname(file)] ?? "application/octet-stream";
    response.writeHead(200, { "content-type": contentType });
    createReadStream(file).pipe(response);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await browser?.close();
  await new Promise((resolve, reject) => server?.close((error) => error ? reject(error) : resolve()));
});

describe("documentation responsive layout", () => {
  it("loads the bundled fonts without third-party requests", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const requests = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto(`${origin}/index.html`, { waitUntil: "networkidle" });
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        manrope: document.fonts.check('400 16px "Manrope"'),
        dmMono400: document.fonts.check('400 16px "DM Mono"'),
        dmMono500: document.fonts.check('500 16px "DM Mono"'),
      };
    });
    assert.deepEqual(fonts, { manrope: true, dmMono400: true, dmMono500: true });
    assert.ok(requests.every((url) => url.startsWith(origin)), `unexpected third-party request: ${requests.find((url) => !url.startsWith(origin))}`);
    for (const font of ["manrope-latin-wght-normal", "dm-mono-latin-400-normal", "dm-mono-latin-500-normal"]) {
      assert.ok(requests.some((url) => url.endsWith(`${font}.woff2`)), `${font} was not loaded`);
    }
    await page.close();
  });

  it("keeps the primary hero action usable in a compact first viewport", async () => {
    const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
    await page.goto(`${origin}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const layout = await page.evaluate(() => {
      const primary = document.querySelector(".hero-actions .primary").getBoundingClientRect();
      const secondary = document.querySelector(".hero-actions .text-link").getBoundingClientRect();
      return { viewportHeight: window.innerHeight, primaryBottom: primary.bottom, secondaryBottom: secondary.bottom };
    });
    assert.ok(layout.primaryBottom <= layout.viewportHeight, `primary CTA ends at ${layout.primaryBottom}px in a ${layout.viewportHeight}px viewport`);
    assert.ok(layout.secondaryBottom <= layout.viewportHeight, `secondary CTA ends at ${layout.secondaryBottom}px in a ${layout.viewportHeight}px viewport`);
    await page.close();
  });

  it("keeps the header on one line at 320px", async () => {
    const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
    await page.goto(`${origin}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const layout = await page.evaluate(() => {
      const wordmark = document.querySelector(".wordmark").getBoundingClientRect();
      const navigation = document.querySelector(".nav nav").getBoundingClientRect();
      const links = Array.from(document.querySelectorAll(".nav nav a")).map((link) => ({
        text: link.textContent.trim(),
        visible: getComputedStyle(link).display !== "none",
        whiteSpace: getComputedStyle(link).whiteSpace,
      }));
      return {
        innerWidth: window.innerWidth,
        bodyWidth: document.body.scrollWidth,
        documentWidth: document.documentElement.scrollWidth,
        wordmarkRight: wordmark.right,
        navigationLeft: navigation.left,
        navigationRight: navigation.right,
        links,
      };
    });
    expectNoOverflow(layout.innerWidth, layout.bodyWidth, "body");
    expectNoOverflow(layout.innerWidth, layout.documentWidth, "document");
    assert.ok(layout.wordmarkRight <= layout.navigationLeft, "wordmark and navigation must not overlap");
    assert.ok(layout.navigationRight <= layout.innerWidth, "navigation must stay inside the viewport");
    assert.deepEqual(layout.links.filter((link) => link.visible).map((link) => link.text), ["Documentation"]);
    assert.ok(layout.links.filter((link) => link.visible).every((link) => link.whiteSpace === "nowrap"), "visible navigation links must remain on one line");
    await page.close();
  });

  it("contains long commands inside the 390px production layout", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${origin}/docs.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const dimensions = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      bodyWidth: document.body.scrollWidth,
      documentWidth: document.documentElement.scrollWidth,
      font: getComputedStyle(document.querySelector("pre code")).fontFamily,
      preBlocks: Array.from(document.querySelectorAll("pre")).map((pre) => ({
        right: pre.getBoundingClientRect().right,
        clientWidth: pre.clientWidth,
        scrollWidth: pre.scrollWidth,
      })),
    }));
    expectNoOverflow(dimensions.innerWidth, dimensions.bodyWidth, "body");
    expectNoOverflow(dimensions.innerWidth, dimensions.documentWidth, "document");
    assert.match(dimensions.font, /DM Mono/);
    assert.ok(dimensions.preBlocks.every((pre) => pre.right <= dimensions.innerWidth));
    assert.ok(dimensions.preBlocks.some((pre) => pre.scrollWidth > pre.clientWidth), "long commands should scroll inside their code block");
    await page.close();
  });
});

function expectNoOverflow(viewportWidth, contentWidth, label) {
  assert.ok(contentWidth <= viewportWidth, `${label} width ${contentWidth}px exceeds viewport ${viewportWidth}px`);
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

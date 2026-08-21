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

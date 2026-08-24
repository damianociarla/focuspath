import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { encode as encodeJpeg } from "jpeg-js";

const width = 32;
const height = 24;
const pixels = Buffer.alloc(width * height * 4);
for (let index = 0; index < pixels.length; index += 4) {
  pixels[index] = 20;
  pixels[index + 1] = 216;
  pixels[index + 2] = 178;
  pixels[index + 3] = 255;
}
const jpeg = encodeJpeg({ data: pixels, width, height }, 80).data;
const report = {
  version: 4,
  direction: "forward",
  url: "https://example.com/native-smoke",
  title: `Native reporter smoke on ${process.platform}/${process.arch}`,
  scannedAt: "2026-08-24T00:00:00.000Z",
  durationMs: 1,
  tabPressCount: 0,
  limits: { maxSteps: 1, maxTabPresses: 1, maxOpaqueTabPresses: 1 },
  viewport: { width, height },
  document: { width, height },
  capture: { sourceWidth: width, sourceHeight: height, truncated: false },
  network: { requestCount: 0, blockedRequestCount: 0, blockedResourceTypes: [] },
  screenshot: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
  stoppedBecause: "no-focusable-elements",
  steps: [],
  issues: [],
};

const repositoryRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const packageDirectory = join(repositoryRoot, "packages", "focuspath");
const npmCli = process.env.npm_execpath;
assert(npmCli, "npm_execpath is required to exercise the packed artifact.");
const temporaryDirectory = await mkdtemp(join(tmpdir(), "focuspath-native-smoke-"));

try {
  const packOutput = runNpm(["pack", packageDirectory, "--json", "--pack-destination", temporaryDirectory], repositoryRoot);
  const [{ filename }] = JSON.parse(packOutput);
  assert.equal(typeof filename, "string");
  const tarball = join(temporaryDirectory, filename);
  await writeFile(join(temporaryDirectory, "package.json"), JSON.stringify({ private: true, type: "module" }));
  runNpm(["install", "--no-audit", "--no-fund", tarball], temporaryDirectory);

  const installedManifest = JSON.parse(await readFile(join(temporaryDirectory, "node_modules", "focuspath", "package.json"), "utf8"));
  const smokeModule = join(temporaryDirectory, "smoke.mjs");
  await writeFile(smokeModule, `
    import assert from "node:assert/strict";
    import { generateHtmlReport as generateFromRoot, scanFocusPath } from "focuspath";
    import { generateHtmlReport as generateFromReporter } from "focuspath/reporter";
    const report = ${JSON.stringify(report)};
    assert.equal(typeof scanFocusPath, "function");
    for (const generateHtmlReport of [generateFromRoot, generateFromReporter]) {
      const html = generateHtmlReport(report);
      assert.match(html, /FocusPath \\/ Report/);
      assert.match(html, /${process.platform}\\/${process.arch}/);
    }
  `);
  execFileSync(process.execPath, [smokeModule], { cwd: temporaryDirectory, stdio: "inherit" });
  const cliVersion = runNpm(["exec", "--offline", "--", "focuspath", "--version"], temporaryDirectory).trim();
  assert.equal(cliVersion, installedManifest.version, "The packed CLI must report the packed package version.");
  console.log(`Packed FocusPath ${cliVersion} passed import, reporter and CLI smoke tests on ${process.platform}/${process.arch}.`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

function runNpm(args, cwd) {
  return execFileSync(process.execPath, [npmCli, ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

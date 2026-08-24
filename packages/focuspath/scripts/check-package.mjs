import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const output = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
  cwd: new URL("../", import.meta.url),
  encoding: "utf8",
});
const [result] = JSON.parse(output);
const files = new Set(result.files.map(({ path }) => path));
const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

for (const required of ["LICENSE", "README.md", "dist/index.js", "dist/index.d.ts", "dist/reporter.js", "dist/reporter.d.ts", "dist/cli.js"]) {
  assert(files.has(required), `npm package is missing ${required}`);
}

assert.equal(manifest.exports?.["./reporter"]?.import, "./dist/reporter.js", "npm package must expose the report-only runtime entry point");
assert.equal(manifest.exports?.["./reporter"]?.types, "./dist/reporter.d.ts", "npm package must expose report-only declarations");

console.log(`Package check passed: ${result.filename} (${result.files.length} files)`);

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const output = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
  cwd: new URL("../", import.meta.url),
  encoding: "utf8",
});
const [result] = JSON.parse(output);
const files = new Set(result.files.map(({ path }) => path));

for (const required of ["LICENSE", "README.md", "dist/index.js", "dist/index.d.ts", "dist/cli.js"]) {
  assert(files.has(required), `npm package is missing ${required}`);
}

console.log(`Package check passed: ${result.filename} (${result.files.length} files)`);

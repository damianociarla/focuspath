import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const rootPackage = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const apiPackage = JSON.parse(await readFile(new URL("../apps/api/package.json", import.meta.url), "utf8"));
const webPackage = JSON.parse(await readFile(new URL("../apps/web/package.json", import.meta.url), "utf8"));
const publicPackage = JSON.parse(await readFile(new URL("../packages/focuspath/package.json", import.meta.url), "utf8"));
const changelog = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const openapi = await readFile(new URL("../docs/openapi.yml", import.meta.url), "utf8");
const expectedVersion = publicPackage.version;
const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;

assert(tag, "Provide a release tag through GITHUB_REF_NAME or the first argument.");
assert.equal(tag, `v${expectedVersion}`, `Tag ${tag} does not match package version ${expectedVersion}.`);
assert.equal(rootPackage.version, expectedVersion, "Root workspace version is not aligned.");
assert.equal(apiPackage.version, expectedVersion, "API workspace version is not aligned.");
assert.equal(webPackage.version, expectedVersion, "Web workspace version is not aligned.");
assert.match(changelog, new RegExp(`^## ${expectedVersion.replaceAll(".", "\\.")}$`, "m"), "Changelog has no entry for this version.");
assert.match(openapi, new RegExp(`^  version: ${expectedVersion.replaceAll(".", "\\.")}$`, "m"), "OpenAPI version is not aligned.");
assert.match(openapi, /^servers:\n {2}- url: https:\/\/d1x165s9roizg5\.cloudfront\.net$/m, "OpenAPI does not expose the hosted beta API server.");

console.log(`Release ${tag} is internally consistent.`);

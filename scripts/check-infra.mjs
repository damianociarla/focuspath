import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const roleTemplate = await readFile(new URL("infra/aws/github-deploy-role.yml", root), "utf8");
const applicationTemplate = await readFile(new URL("infra/aws/apprunner.yml", root), "utf8");
const releaseWorkflow = await readFile(new URL(".github/workflows/release.yml", root), "utf8");
const workflowFiles = await Promise.all([
  ".github/workflows/ci.yml",
  ".github/workflows/pages.yml",
  ".github/workflows/release.yml",
].map(async (path) => [path, await readFile(new URL(path, root), "utf8")]));

for (const wildcard of ["apprunner:*", "cloudfront:*", "budgets:*"]) {
  assert(!roleTemplate.includes(wildcard), `Infrastructure role must not grant ${wildcard}.`);
}
assert.match(roleTemplate, /FocusPathApplicationRoleBoundary:/, "The application role boundary must remain in the bootstrap stack.");
assert.match(roleTemplate, /ApplicationRoleName:/, "The existing FocusPath application role must be explicit.");
assert.match(
  roleTemplate,
  /Action: iam:PassRole\n\s+Resource: !Sub "arn:\$\{AWS::Partition\}:iam::\$\{AWS::AccountId\}:role\/\$\{ApplicationRoleName\}"/,
  "PassRole must remain scoped to the exact FocusPath application role.",
);
for (const logicalId of ["ApiAutoScaling", "ApiService"]) {
  const resourceStart = applicationTemplate.indexOf(`  ${logicalId}:`);
  const nextResource = [...applicationTemplate.matchAll(/^  [A-Za-z0-9]+:\n/gm)]
    .map((match) => match.index ?? -1)
    .find((index) => index > resourceStart);
  const resource = applicationTemplate.slice(resourceStart, nextResource);
  assert(!/^\s+Tags:/m.test(resource), `${logicalId} tags trigger an unsafe App Runner replacement.`);
}

const deployIndex = releaseWorkflow.indexOf("  deploy-api:");
const publishIndex = releaseWorkflow.indexOf("  publish-npm:");
assert(deployIndex >= 0 && publishIndex > deployIndex, "AWS deployment must precede npm publication.");
assert.match(releaseWorkflow, /publish-npm:\n\s+needs: deploy-api/, "npm publication must require a healthy API deployment.");
assert.match(releaseWorkflow, /workflow_dispatch:/, "Release recovery must remain manually invokable.");
assert.match(
  releaseWorkflow,
  /if npm view "focuspath@\$\{version\}" version >\/dev\/null 2>&1; then/,
  "npm recovery must distinguish a missing version from registry JSON error output.",
);

for (const [path, workflow] of workflowFiles) {
  for (const match of workflow.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)/gm)) {
    const reference = match[1] ?? "";
    assert.match(reference, /@[a-f0-9]{40}$/, `${path} contains a non-immutable action reference: ${reference}`);
  }
}

console.log("Infrastructure and workflow guardrails are valid.");

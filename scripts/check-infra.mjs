import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { parseDocument } from "yaml";

const root = new URL("../", import.meta.url);
const roleTemplate = await readFile(new URL("infra/aws/github-deploy-role.yml", root), "utf8");
const applicationTemplate = await readFile(new URL("infra/aws/apprunner.yml", root), "utf8");
const releaseWorkflow = await readFile(new URL(".github/workflows/release.yml", root), "utf8");
const dependabot = await readFile(new URL(".github/dependabot.yml", root), "utf8");

async function collectYamlFiles(directory, relativeDirectory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) files.push(...await collectYamlFiles(entryUrl, relativePath));
    if (entry.isFile() && /\.ya?ml$/i.test(entry.name)) files.push([relativePath, await readFile(entryUrl, "utf8")]);
  }
  return files;
}

const githubYamlFiles = await collectYamlFiles(new URL(".github/", root), ".github");
const workflowFiles = githubYamlFiles.filter(([path]) => path.startsWith(".github/workflows/"));

for (const [path, contents] of githubYamlFiles) {
  const document = parseDocument(contents, { prettyErrors: false });
  assert.equal(document.errors.length, 0, `${path} is invalid YAML: ${document.errors.map((error) => error.message).join("; ")}`);
}

for (const wildcard of ["apprunner:*", "cloudfront:*", "budgets:*"]) {
  assert(!roleTemplate.includes(wildcard), `Infrastructure role must not grant ${wildcard}.`);
}
for (const forbiddenAction of [
  "iam:AttachRolePolicy",
  "iam:DeleteRolePermissionsBoundary",
  "iam:DetachRolePolicy",
  "iam:PutRolePermissionsBoundary",
  "iam:PutRolePolicy",
  "iam:UpdateAssumeRolePolicy",
]) {
  assert(!roleTemplate.includes(forbiddenAction), `CloudFormation execution must not receive ${forbiddenAction}.`);
}
assert.match(roleTemplate, /FocusPathApplicationRoleBoundary:/, "The application boundary must remain in the bootstrap stack.");
assert.match(roleTemplate, /AppRunnerEcrAccessRole:\n[\s\S]*?PermissionsBoundary: !Ref FocusPathApplicationRoleBoundary/, "The bootstrap application role must retain its boundary.");
assert.match(roleTemplate, /ApplicationRoleArn:\n\s+Value: !GetAtt AppRunnerEcrAccessRole\.Arn/, "The bootstrap stack must export the immutable application role ARN.");
assert.match(roleTemplate, /Action:\n\s+- iam:GetRole\n\s+- iam:PassRole\n\s+Resource: !GetAtt AppRunnerEcrAccessRole\.Arn/, "Application-stack IAM access must be limited to GetRole and PassRole on the bootstrap role.");
assert.match(roleTemplate, /environment:\$\{ReleaseEnvironmentName\}/, "AWS trust must use the protected GitHub environment subject.");
assert.match(roleTemplate, /environment:\$\{RollbackEnvironmentName\}/, "AWS trust must include the approval-gated rollback environment subject.");
assert(!roleTemplate.includes(":ref:refs/tags/"), "AWS trust must not depend on a tag subject that recovery cannot emit.");

assert(!applicationTemplate.includes("AWS::IAM::Role"), "The application stack must not own IAM roles.");
assert.match(applicationTemplate, /AppRunnerEcrAccessRoleArn:/, "The application stack must accept the bootstrap role ARN.");
assert.match(applicationTemplate, /AccessRoleArn: !Ref AppRunnerEcrAccessRoleArn/, "App Runner must use the bootstrap role ARN.");
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
const credentialsIndex = releaseWorkflow.indexOf("aws-actions/configure-aws-credentials@", deployIndex);
const preflightIndex = releaseWorkflow.indexOf("Check whether the API already matches", deployIndex);
assert(deployIndex >= 0 && publishIndex > deployIndex, "AWS deployment must precede npm publication.");
assert.match(releaseWorkflow, /publish-npm:\n\s+needs: deploy-api/, "npm publication must require a healthy API deployment.");
assert.match(releaseWorkflow, /workflow_dispatch:/, "Release recovery must remain manually invokable.");
assert.match(releaseWorkflow, /allow_downgrade:[\s\S]*?default: false[\s\S]*?type: boolean/, "Release recovery must require an explicit downgrade choice.");
assert.match(releaseWorkflow, /concurrency:\n  group: focuspath-production-release\n  cancel-in-progress: false/, "All production releases must share one non-cancelling concurrency group.");
assert.match(releaseWorkflow, /deploy-api:[\s\S]*?environment: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.allow_downgrade && 'production-rollback' \|\| 'production' \}\}/, "Intentional downgrades must use the approval-gated rollback environment.");
assert(credentialsIndex > deployIndex && credentialsIndex < preflightIndex, "Every release recovery must exercise AWS OIDC before the API preflight.");
assert.match(releaseWorkflow, /Refusing to downgrade production from \$\{actual\} to \$\{expected\}/, "Recovery must reject an older API version by default.");
assert.match(releaseWorkflow, /Approved rollback from \$\{actual\} to \$\{expected\} through the protected rollback environment/, "Approved downgrades must be auditable in release logs.");
assert.match(releaseWorkflow, /FOCUSPATH_APPLICATION_ROLE_ARN: \$\{\{ vars\.AWS_APPLICATION_ROLE_ARN \}\}/, "Deployments must pass the bootstrap application role ARN.");
assert.match(releaseWorkflow, /env -u GITHUB_REF_NAME node scripts\/check-release\.mjs "\$\{RELEASE_TAG\}"/, "Recovery validation must remove the trigger ref after checking out an existing tag.");
assert.match(releaseWorkflow, /if npm view "focuspath@\$\{version\}" version >\/dev\/null 2>&1; then/, "npm recovery must distinguish a missing version from registry JSON error output.");
assert.match(releaseWorkflow, /publish-npm:[\s\S]*?npx playwright install --with-deps chromium[\s\S]*?npm publish --workspace focuspath/, "The npm publish job must satisfy the package prepublish Playwright tests.");
assert.match(dependabot, /update-types: \[minor, patch\]/, "Grouped Dependabot updates must exclude breaking major releases.");

for (const [path, workflow] of workflowFiles) {
  for (const match of workflow.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)/gm)) {
    const reference = match[1] ?? "";
    assert.match(reference, /@[a-f0-9]{40}$/, `${path} contains a non-immutable action reference: ${reference}`);
  }
}

console.log(`Infrastructure and workflow guardrails are valid; parsed ${githubYamlFiles.length} GitHub YAML files.`);

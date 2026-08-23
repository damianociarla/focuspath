import assert from "node:assert/strict";
import test from "node:test";
import { extractImageVersion } from "./extract-image-version.mjs";

test("extracts the deployed release from a CloudFormation image parameter", () => {
  assert.equal(extractImageVersion("123456789012.dkr.ecr.eu-west-1.amazonaws.com/focuspath-api:v0.6.4"), "0.6.4");
});

test("reconstructs SemVer build metadata normalized for OCI tags", () => {
  assert.equal(extractImageVersion("registry/focuspath-api:v1.2.3-rc.1_build_review.2"), "1.2.3-rc.1+review.2");
});

test("rejects digests and unrelated image tags", () => {
  assert.throws(() => extractImageVersion("registry/focuspath-api@sha256:abc"), /release tag/);
  assert.throws(() => extractImageVersion("registry/focuspath-api:latest"), /SemVer/);
});

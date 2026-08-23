import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyReleaseTransition } from "./classify-release-transition.mjs";

describe("production release transition policy", () => {
  it("distinguishes identical and forward transitions", () => {
    assert.equal(classifyReleaseTransition("1.2.3", "1.2.3"), "same");
    assert.equal(classifyReleaseTransition("1.2.3", "1.2.4"), "forward");
  });

  it("protects semantic-version downgrades", () => {
    assert.equal(classifyReleaseTransition("2.0.0", "1.9.9"), "rollback");
  });

  it("protects distinct artifacts with equal SemVer precedence", () => {
    assert.equal(classifyReleaseTransition("1.2.3+new", "1.2.3+old"), "replacement");
  });
});

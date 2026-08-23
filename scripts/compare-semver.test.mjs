import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareSemVer } from "./compare-semver.mjs";

describe("release semantic-version ordering", () => {
  it("orders patch, minor and major versions", () => {
    assert.equal(compareSemVer("1.2.4", "1.2.3"), 1);
    assert.equal(compareSemVer("1.3.0", "1.2.99"), 1);
    assert.equal(compareSemVer("2.0.0", "1.99.99"), 1);
    assert.equal(compareSemVer("0.6.1", "0.6.2"), -1);
  });

  it("implements SemVer prerelease precedence", () => {
    const ordered = ["1.0.0-alpha", "1.0.0-alpha.1", "1.0.0-alpha.beta", "1.0.0-beta", "1.0.0-beta.2", "1.0.0-beta.11", "1.0.0-rc.1", "1.0.0"];
    for (let index = 1; index < ordered.length; index += 1) {
      assert.equal(compareSemVer(ordered[index], ordered[index - 1]), 1);
    }
  });

  it("ignores build metadata when determining precedence", () => {
    assert.equal(compareSemVer("1.2.3+build.4", "1.2.3+other.9"), 0);
    assert.equal(compareSemVer("1.2.3-rc.1+build.4", "1.2.3-rc.1"), 0);
  });

  it("recognises equal versions", () => {
    assert.equal(compareSemVer("0.6.3", "0.6.3"), 0);
  });

  it("rejects invalid semantic versions", () => {
    for (const value of ["1.2", "v1.2.3", "01.2.3", "1.2.3-01", "1.2.3+bad_metadata", "latest"]) {
      assert.throws(() => compareSemVer(value, "1.0.0"), /Invalid semantic version/);
    }
  });
});

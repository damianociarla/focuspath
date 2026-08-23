import { pathToFileURL } from "node:url";
import { compareSemVer } from "./compare-semver.mjs";

export function classifyReleaseTransition(actual, expected) {
  if (actual === expected) return "same";
  const ordering = compareSemVer(actual, expected);
  if (ordering < 0) return "forward";
  if (ordering > 0) return "rollback";
  return "replacement";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , actual, expected] = process.argv;
  if (!actual || !expected) throw new Error("Usage: node scripts/classify-release-transition.mjs <actual> <expected>");
  console.log(classifyReleaseTransition(actual, expected));
}

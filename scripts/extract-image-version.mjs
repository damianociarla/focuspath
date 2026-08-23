import { pathToFileURL } from "node:url";

export function extractImageVersion(imageIdentifier) {
  if (typeof imageIdentifier !== "string" || imageIdentifier.length === 0) {
    throw new TypeError("Image identifier is required.");
  }
  const image = imageIdentifier.split("@")[0];
  const slash = image.lastIndexOf("/");
  const colon = image.lastIndexOf(":");
  if (colon <= slash) throw new TypeError("Image identifier does not contain a release tag.");
  const tag = image.slice(colon + 1);
  if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:_build_[0-9A-Za-z.-]+)?$/.test(tag)) {
    throw new TypeError("Image identifier does not contain a FocusPath SemVer release tag.");
  }
  return tag.slice(1).replace("_build_", "+");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const imageIdentifier = process.argv[2];
  if (!imageIdentifier) throw new Error("Usage: node scripts/extract-image-version.mjs <image-identifier>");
  console.log(extractImageVersion(imageIdentifier));
}

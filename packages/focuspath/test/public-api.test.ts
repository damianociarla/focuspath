import { describe, expect, it } from "vitest";
import { generateHtmlReport, scanFocusPath } from "../src/index.js";

describe("documented public API", () => {
  it("exports the functions used by the TypeScript documentation example", () => {
    expect(generateHtmlReport).toBeTypeOf("function");
    expect(scanFocusPath).toBeTypeOf("function");
  });
});

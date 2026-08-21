import { describe, expect, it } from "vitest";
import { assertPublicUrl, isPublicAddress, parseHttpUrl, UnsafeUrlError } from "../src/network-policy.js";

describe("network policy", () => {
  it.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "192.168.1.2", "::1", "fc00::1"])("blocks private address %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])("allows public address %s", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it("normalizes a public hostname", async () => {
    await expect(assertPublicUrl("example.com")).resolves.toMatchObject({ protocol: "https:" });
  });

  it("validates URL syntax without resolving DNS", () => {
    expect(parseHttpUrl("example.com").toString()).toBe("https://example.com/");
    expect(() => parseHttpUrl("ftp://example.com")).toThrow(UnsafeUrlError);
  });

  it.each(["http://localhost", "http://127.0.0.1", "http://169.254.169.254/latest/meta-data", "https://example.com:8443"])("rejects unsafe URL %s", async (url) => {
    await expect(assertPublicUrl(url)).rejects.toBeInstanceOf(UnsafeUrlError);
  });
});

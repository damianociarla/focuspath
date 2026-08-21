import { describe, expect, it } from "vitest";
import { assertPublicUrl, isPublicAddress, parseHttpUrl, resolvePublicTarget, UnsafeUrlError } from "../src/network-policy.js";

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

  it("returns the exact public addresses from one DNS resolution", async () => {
    let resolutions = 0;
    const target = await resolvePublicTarget("https://rebind.example/path", async () => {
      resolutions += 1;
      return [{ address: "93.184.216.34" }, { address: "2606:2800:220:1:248:1893:25c8:1946" }];
    });

    expect(resolutions).toBe(1);
    expect(target.addresses).toEqual(["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"]);
  });

  it("accepts a public bracketed IPv6 literal without a DNS lookup", async () => {
    let resolutions = 0;
    const target = await resolvePublicTarget("https://[2606:4700:4700::1111]/", async () => {
      resolutions += 1;
      return [];
    });

    expect(resolutions).toBe(0);
    expect(target.addresses).toEqual(["2606:4700:4700::1111"]);
  });

  it("rejects a hostname when the pinned resolution contains a private address", async () => {
    await expect(resolvePublicTarget("https://rebind.example", async () => [
      { address: "93.184.216.34" },
      { address: "127.0.0.1" },
    ])).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it.each(["http://localhost", "http://127.0.0.1", "http://169.254.169.254/latest/meta-data", "https://[::1]", "https://example.com:8443"])("rejects unsafe URL %s", async (url) => {
    await expect(assertPublicUrl(url)).rejects.toBeInstanceOf(UnsafeUrlError);
  });
});

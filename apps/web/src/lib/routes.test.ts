import { describe, expect, it } from "vitest";
import { isPublicPath, safeNextPath } from "./routes";

describe("isPublicPath", () => {
  it("allows only the auth and health routes", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/projects")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/projects/storefront", "/projects/storefront"],
    ["/audit?cursor=abc", "/audit?cursor=abc"],
    ["https://evil.example", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["javascript:alert(1)", "/"],
    [null, "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

import { describe, expect, it } from "vitest";
import { mapDbError } from "./errors";

describe("mapDbError", () => {
  it("maps privilege errors and keeps MFA hints", () => {
    expect(mapDbError({ code: "42501", message: "not allowed" }).code).toBe("forbidden");
    expect(mapDbError({ code: "42501", message: "two-factor verification required" }).message).toMatch(/two-factor/);
  });
  it("maps uniqueness and validation errors", () => {
    expect(mapDbError({ code: "23505", message: "duplicate key value" }).code).toBe("conflict");
    expect(mapDbError({ code: "22023", message: "a production environment is required" })).toEqual({
      code: "bad_request",
      message: "A production environment is required.",
    });
  });
  it("hides unknown internals", () => {
    expect(mapDbError({ code: "XX000", message: "relation secret_table does not exist" })).toEqual({
      code: "internal",
      message: "Something went wrong. Try again.",
    });
  });
});

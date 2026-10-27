import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./queries";

describe("audit cursors", () => {
  it("round-trips", () => {
    const c = encodeCursor("2026-10-27T10:00:00.000Z", "6f1c2a8e-5b1d-4c3e-9f2a-1b2c3d4e5f60");
    expect(decodeCursor(c)).toEqual({ createdAt: "2026-10-27T10:00:00.000Z", id: "6f1c2a8e-5b1d-4c3e-9f2a-1b2c3d4e5f60" });
  });

  it("rejects tampered cursors that try to inject PostgREST filters", () => {
    const evil = Buffer.from(JSON.stringify(["2026-01-01),organization_id.neq.x", "nope"])).toString("base64url");
    expect(decodeCursor(evil)).toBeNull();
    const evilId = Buffer.from(JSON.stringify(["2026-01-01T00:00:00Z", "x,or(id.gt.0)"])).toString("base64url");
    expect(decodeCursor(evilId)).toBeNull();
    expect(decodeCursor("not-base64-json")).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
  });
});

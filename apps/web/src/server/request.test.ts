import { describe, expect, it } from "vitest";
import { pickClientIp } from "./request";

describe("pickClientIp", () => {
  it("ignores client-supplied entries left of the trusted hops", () => {
    expect(pickClientIp("6.6.6.6, 203.0.113.7", 1)).toBe("203.0.113.7");
    expect(pickClientIp("6.6.6.6, 203.0.113.7, 10.0.0.2", 2)).toBe("203.0.113.7");
  });
  it("returns null when the chain is shorter than the trusted hops", () => {
    expect(pickClientIp(null, 1)).toBeNull();
    expect(pickClientIp("203.0.113.7", 2)).toBeNull();
    expect(pickClientIp("203.0.113.7", 0)).toBeNull();
  });
});

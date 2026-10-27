import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limit";

describe("RateLimiter", () => {
  it("allows up to the limit within a window, then blocks", () => {
    const limiter = new RateLimiter(3, 1000);
    expect([1, 2, 3, 4].map(() => limiter.take("ip", 0))).toEqual([true, true, true, false]);
    expect(limiter.take("other", 0)).toBe(true);
  });

  it("resets after the window", () => {
    const limiter = new RateLimiter(1, 1000);
    expect(limiter.take("ip", 0)).toBe(true);
    expect(limiter.take("ip", 500)).toBe(false);
    expect(limiter.take("ip", 1000)).toBe(true);
  });

  it("keeps memory bounded", () => {
    const limiter = new RateLimiter(1, 60_000, 100);
    for (let i = 0; i < 1000; i++) limiter.take(`k${i}`, 0);
    expect((limiter as unknown as { hits: Map<string, unknown> }).hits.size).toBeLessThanOrEqual(100);
  });
});

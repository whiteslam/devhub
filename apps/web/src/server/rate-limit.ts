/**
 * Fixed-window limiter held in process memory. It protects a single
 * instance from brute-force bursts in front of Supabase Auth's own limits;
 * multi-instance deployments need a shared store (see docs/security.md).
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 10_000,
  ) {}

  /** Returns true when the call is allowed. */
  take(key: string, now = Date.now()): boolean {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      if (this.hits.size >= this.maxKeys) this.evict(now);
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }

  private evict(now: number) {
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
    // Still full: drop the oldest entries so memory stays bounded.
    while (this.hits.size >= this.maxKeys) {
      const oldest = this.hits.keys().next().value;
      if (oldest === undefined) break;
      this.hits.delete(oldest);
    }
  }
}

export const authLimiter = new RateLimiter(10, 10 * 60_000);
/** Per account (email or user id), independent of source address. */
export const accountLimiter = new RateLimiter(10, 15 * 60_000);

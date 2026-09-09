import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
// Relative import, like push-utils.test.ts: the module under test has no
// internal imports, so the suite needs no vitest config.
import { checkRateLimit, resetRateLimits, getClientIp, normalizeEmailKey } from "./rate-limit";

const OPTS = { limit: 3, windowMs: 1000 };

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the threshold", () => {
    expect(checkRateLimit("k", OPTS).allowed).toBe(true);
    expect(checkRateLimit("k", OPTS).allowed).toBe(true);
    const third = checkRateLimit("k", OPTS);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it("blocks once the threshold is exceeded", () => {
    checkRateLimit("k", OPTS);
    checkRateLimit("k", OPTS);
    checkRateLimit("k", OPTS);
    const blocked = checkRateLimit("k", OPTS);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window slides past the oldest hit", () => {
    checkRateLimit("k", OPTS);
    checkRateLimit("k", OPTS);
    checkRateLimit("k", OPTS);
    expect(checkRateLimit("k", OPTS).allowed).toBe(false);

    // Move past the window entirely — the earliest hit falls out of range.
    vi.setSystemTime(OPTS.windowMs + 1);
    expect(checkRateLimit("k", OPTS).allowed).toBe(true);
  });

  it("slides rather than resetting on a fixed boundary", () => {
    // Two hits at t=0, then advance to just inside the window: those two
    // still count, so only one more request is allowed before blocking.
    checkRateLimit("k", OPTS);
    checkRateLimit("k", OPTS);
    vi.setSystemTime(OPTS.windowMs - 1);
    expect(checkRateLimit("k", OPTS).allowed).toBe(true); // 3rd hit, at the cap
    expect(checkRateLimit("k", OPTS).allowed).toBe(false); // 4th hit, still within window of the first two
  });

  it("tracks independent keys separately", () => {
    checkRateLimit("a", OPTS);
    checkRateLimit("a", OPTS);
    checkRateLimit("a", OPTS);
    expect(checkRateLimit("a", OPTS).allowed).toBe(false);

    // A different key has its own budget, unaffected by "a" being exhausted.
    expect(checkRateLimit("b", OPTS).allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("takes the first hop from x-forwarded-for", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const req = new Request("https://example.com", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(getClientIp(req)).toBe("9.9.9.9");
  });

  it("falls back to a constant when no proxy header is present", () => {
    const req = new Request("https://example.com");
    expect(getClientIp(req)).toBe("unknown");
  });
});

describe("normalizeEmailKey", () => {
  it("trims and lowercases so the same address always maps to one bucket", () => {
    expect(normalizeEmailKey("  User@Example.com  ")).toBe("user@example.com");
  });
});

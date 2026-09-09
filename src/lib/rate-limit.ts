// Lightweight in-memory sliding-window rate limiter for auth endpoints
// (register, password-reset request, credentials login).
//
// State lives in a plain Map in this process's memory: it is per-instance
// and resets on redeploy/restart, and is NOT shared across multiple
// instances/regions. That's an acceptable tradeoff for this app's current
// single-instance scale (see GitHub #135) — swap in Redis/Upstash if this
// ever runs as more than one instance.

interface RateLimitOptions {
  /** Maximum number of hits allowed within the window. */
  limit: number;
  /** Sliding window size, in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Remaining hits allowed within the current window. */
  remaining: number;
  /** Seconds to wait before retrying, 0 when allowed. */
  retryAfterSeconds: number;
}

const hits = new Map<string, number[]>();

/**
 * Records a hit for `key` and reports whether it is allowed under a sliding
 * window of `windowMs` milliseconds capped at `limit` hits. Timestamps older
 * than the window are dropped on every call, so the window "slides" rather
 * than resetting on fixed boundaries.
 */
export function checkRateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    hits.set(key, recent);
    const retryAfterMs = windowMs - (now - recent[0]);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  recent.push(now);
  hits.set(key, recent);
  return { allowed: true, remaining: limit - recent.length, retryAfterSeconds: 0 };
}

/** Clears all rate-limit state. Exposed for tests only. */
export function resetRateLimits(): void {
  hits.clear();
}

/**
 * Best-effort client IP from proxy headers (Vercel/most reverse proxies set
 * x-forwarded-for as "client, proxy1, proxy2..."). Falls back to a constant
 * so requests without the header still share one bucket instead of crashing.
 */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/** Normalizes an email for use as a rate-limit key. */
export function normalizeEmailKey(email: string): string {
  return email.trim().toLowerCase();
}

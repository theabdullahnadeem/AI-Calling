import "server-only";

/**
 * Fixed-window rate limiter for the auth endpoints (login, set-password).
 *
 * In-memory for now, which is honest-but-imperfect on serverless: each warm
 * instance keeps its own counters, so the effective limit is per-instance.
 * That still blunts naive credential-stuffing from a single source. Prompt 3
 * introduces Upstash Redis — swap the Map for Redis INCR/EXPIRE then so the
 * limit is global. The call-site API is designed so only this file changes.
 */

type Bucket = { count: number; resetAtMs: number };

const buckets = new Map<string, Bucket>();

const MAX_BUCKETS = 10_000;

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export function checkRateLimit(
  key: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number },
): RateLimitResult {
  const now = Date.now();

  // Opportunistic sweep so the map can't grow without bound under a
  // key-spraying attack.
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) {
      if (b.resetAtMs <= now) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAtMs <= now) {
    buckets.set(key, { count: 1, resetAtMs: now + windowSeconds * 1000 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.resetAtMs - now) / 1000),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** 10 attempts / 15 min per (ip, email) pair — login brute-force guard. */
export function loginRateLimit(ip: string, email: string): RateLimitResult {
  return checkRateLimit(`login:${ip}:${email}`, {
    limit: 10,
    windowSeconds: 15 * 60,
  });
}

/** 10 attempts / hour per ip — set-password token guessing guard. */
export function setPasswordRateLimit(ip: string): RateLimitResult {
  return checkRateLimit(`set-password:${ip}`, {
    limit: 10,
    windowSeconds: 60 * 60,
  });
}

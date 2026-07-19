import "server-only";

/**
 * Fixed-window rate limiter for the auth endpoints (login, set-password).
 *
 * Backed by Redis (INCR + EXPIRE) so the limit is GLOBAL across serverless
 * instances — a distributed credential-stuffing run can't shard itself across
 * warm lambdas. If Redis is unreachable the in-memory fallback still blunts
 * single-instance abuse rather than failing wide open.
 */

type Bucket = { count: number; resetAtMs: number };

const buckets = new Map<string, Bucket>();

const MAX_BUCKETS = 10_000;

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

function checkInMemory(
  key: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number },
): RateLimitResult {
  const now = Date.now();

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

export async function checkRateLimit(
  key: string,
  options: { limit: number; windowSeconds: number },
): Promise<RateLimitResult> {
  try {
    const { redis } = await import("./redis");
    const client = redis();
    const redisKey = `rl:${key}`;
    const count = await client.incr(redisKey);
    if (count === 1) {
      await client.expire(redisKey, options.windowSeconds);
    }
    if (count > options.limit) {
      const ttl = await client.ttl(redisKey);
      return { allowed: false, retryAfterSeconds: Math.max(ttl, 1) };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  } catch (error) {
    console.error(
      "[rate-limit] Redis unavailable, using in-memory fallback:",
      error instanceof Error ? error.message : error,
    );
    return checkInMemory(key, options);
  }
}

/** 10 attempts / 15 min per (ip, email) pair — login brute-force guard. */
export function loginRateLimit(
  ip: string,
  email: string,
): Promise<RateLimitResult> {
  return checkRateLimit(`login:${ip}:${email}`, {
    limit: 10,
    windowSeconds: 15 * 60,
  });
}

/** 10 attempts / hour per ip — set-password token guessing guard. */
export function setPasswordRateLimit(ip: string): Promise<RateLimitResult> {
  return checkRateLimit(`set-password:${ip}`, {
    limit: 10,
    windowSeconds: 60 * 60,
  });
}

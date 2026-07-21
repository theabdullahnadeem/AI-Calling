import "server-only";

import { Redis } from "@upstash/redis";

/**
 * Upstash Redis over its REST API rather than a TCP client (ioredis).
 *
 * This is the right fit for Vercel serverless: every call is a stateless
 * HTTPS request, so there are no TCP sockets to leak and no connection-limit
 * exhaustion when many functions are warm at once. docs/02 anticipated this
 * ("REDIS_URL — and token, if using Upstash's REST client").
 *
 * NOTE: this client serializes/deserializes JSON automatically. Store plain
 * objects and read plain objects back — do NOT JSON.stringify on the way in,
 * or you'll get a double-encoded string on the way out.
 */

const globalForRedis = globalThis as unknown as { redis?: Redis };

export function redis(): Redis {
  if (!globalForRedis.redis) {
    // Reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
    globalForRedis.redis = Redis.fromEnv();
  }
  return globalForRedis.redis;
}

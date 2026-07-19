import "server-only";

import Redis from "ioredis";

import { serverEnv } from "./env";

// Singleton across hot reloads / route invocations within a warm instance —
// serverless functions must not open a fresh TCP connection per request.
const globalForRedis = globalThis as unknown as { redis?: Redis };

export function redis(): Redis {
  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(serverEnv("REDIS_URL"), {
      maxRetriesPerRequest: 2,
      enableAutoPipelining: true,
    });
    globalForRedis.redis.on("error", (error) => {
      console.error("[redis] connection error:", error.message);
    });
  }
  return globalForRedis.redis;
}

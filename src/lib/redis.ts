import IORedis from "ioredis";

const globalForRedis = globalThis as unknown as { redis: IORedis };

function createRedisClient(): IORedis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL environment variable is required");
  return new IORedis(url, { maxRetriesPerRequest: null });
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

import { Queue } from "bullmq";
import { redis } from "../lib/redis.js";

export const sercopSyncQueue = new Queue("sercop-sync", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 10_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export const processAlertsQueue = new Queue("process-alerts", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 100 },
  },
});

export const sendNotificationsQueue = new Queue("send-notifications", {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 200 },
  },
});

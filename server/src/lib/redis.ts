import { Redis } from "ioredis";
import { baseEnv } from "./env";

let client: Redis | undefined;

/** The process's one Redis connection: queues, workers, rate limits and health checks. BullMQ needs maxRetriesPerRequest: null. */
export function redis(): Redis {
  client ??= new Redis(baseEnv().REDIS_URL, { maxRetriesPerRequest: null, family: 0 });
  return client;
}

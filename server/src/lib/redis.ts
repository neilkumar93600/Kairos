import { Redis } from "ioredis";
import { env } from "./env";

let client: Redis | undefined;

/** Shared connection for health checks and rate limits. BullMQ needs maxRetriesPerRequest: null. */
export function redis(): Redis {
  client ??= new Redis(env().REDIS_URL, { maxRetriesPerRequest: null, family: 0 });
  return client;
}

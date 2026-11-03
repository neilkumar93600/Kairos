import { Redis } from "ioredis";
import { baseEnv } from "./env";

let client: Redis | undefined;

/** The process's one Redis connection: queues, workers, rate limits and health checks. BullMQ needs maxRetriesPerRequest: null. */
export function redis(): Redis {
  client ??= new Redis(baseEnv().REDIS_URL, { maxRetriesPerRequest: null, family: 0 });
  return client;
}

/**
 * Every process refuses to boot unless Redis runs with maxmemory-policy noeviction (platform-68): under any other
 * policy a full Redis silently drops queued jobs and their locks instead of refusing writes.
 */
export async function assertNoEviction(server: Pick<Redis, "info"> = redis()): Promise<void> {
  const policy = (await server.info("memory")).match(/^maxmemory_policy:(\S+)/m)?.[1];
  if (policy !== "noeviction") {
    throw new Error(`Redis maxmemory-policy is ${policy ?? "unknown"}; BullMQ needs noeviction (owner-actions/WP-45.md)`);
  }
}

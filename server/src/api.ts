import { sql } from "drizzle-orm";
import { createApp } from "./app";
import { closeDb, db } from "./db/client";
import { authGateway } from "./lib/auth";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { redis } from "./lib/redis";
import { initSentry } from "./lib/sentry";
import { closeQueues } from "./jobs/queues";

const e = env();
initSentry("api");
// Without it every web user shares the Vercel egress address in every IP limit, sign-in included (05-api 5.5).
// ponytail: checked here, not in env.ts, so the worker and applier never need the secret; move into the api role schema with WP-04.
if (e.NODE_ENV === "production" && !e.KAIROS_EDGE_SECRET) throw new Error("Invalid environment:\n  KAIROS_EDGE_SECRET: required on the api in production");
const app = createApp({
  auth: authGateway(),
  corsOrigins: [e.WEB_ORIGIN, ...(e.EXTENSION_ORIGIN ? [e.EXTENSION_ORIGIN] : [])],
  edgeSecret: e.KAIROS_EDGE_SECRET,
  proxyHops: e.TRUSTED_PROXY_HOPS_DIRECT,
  sharedLimits: true,
  healthChecks: {
    database: async () => {
      await db().execute(sql`select 1`);
    },
    redis: async () => {
      await redis().ping();
    },
  },
});

const server = app.listen(e.PORT, () => logger.info({ port: e.PORT }, "api listening"));

async function shutdown(signal: string) {
  logger.info({ signal }, "api shutting down");
  server.close();
  await Promise.allSettled([closeQueues(), closeDb(), redis().quit()]);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

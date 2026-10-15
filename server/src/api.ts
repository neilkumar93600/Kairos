import { sql } from "drizzle-orm";
import { createApp } from "./app";
import { closeDb, db } from "./db/client";
import { authGateway } from "./lib/auth";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { redis } from "./lib/redis";
import { closeQueues } from "./jobs/queues";

const e = env();
const app = createApp({
  auth: authGateway(),
  corsOrigins: [e.WEB_ORIGIN, ...(e.EXTENSION_ORIGIN ? [e.EXTENSION_ORIGIN] : [])],
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

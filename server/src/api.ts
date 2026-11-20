import { sql } from "drizzle-orm";
import { createApp } from "./app";
import { closeDb, db } from "./db/client";
import { authGateway } from "./lib/auth";
import { env } from "./lib/env";
import { closeServer, deadline, isDraining, onShutdown } from "./lib/lifecycle";
import { logger } from "./lib/logger";
import { gatewayFlags, getFlags } from "./lib/flags";
import { configureGateway } from "./llm/gateway";
import { startMetricsFlush } from "./lib/metrics";
import { assertNoEviction, redis } from "./lib/redis";
import { initSentry } from "./lib/sentry";
import { closeQueues } from "./jobs/queues";
import { csrfOrigins } from "./middleware/origin-guard";

const e = env();
initSentry("api");
// Kill switches, pins, canaries and shadows from ops_flags, read through the 10 s flag cache (03-agent-runtime 4.5).
configureGateway({ flags: gatewayFlags });
// Without it every web user shares the Vercel egress address in every IP limit, sign-in included (05-api 5.5).
// ponytail: checked here, not in env.ts, so the worker and applier never need the secret; move into the api role schema with WP-04.
if (e.NODE_ENV === "production" && !e.KAIROS_EDGE_SECRET) throw new Error("Invalid environment:\n  KAIROS_EDGE_SECRET: required on the api in production");
// The api enqueues approvals and drafts: a Redis that evicts would drop them silently (platform-68).
await deadline(assertNoEviction(), 10_000);
// A deploy during a pause must not let calls through: kill switches are read before the server takes work, bounded so a
// database outage cannot hold the boot (gatewayFlags refuses model calls until a load succeeds).
await deadline(getFlags(), 5_000).catch((err: unknown) => logger.warn({ err }, "flags not read at boot; model calls refused until they are"));
const app = createApp({
  auth: authGateway(),
  corsOrigins: [e.WEB_ORIGIN, ...(e.EXTENSION_ORIGIN ? [e.EXTENSION_ORIGIN] : [])],
  csrfOrigins: csrfOrigins(e),
  edgeSecret: e.KAIROS_EDGE_SECRET,
  proxyHops: e.TRUSTED_PROXY_HOPS_DIRECT,
  sharedLimits: true,
  isDraining,
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
// Above the proxy's idle timeout, so the proxy closes an idle keep-alive connection, never node mid-request (platform-46).
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 120_000;

// 25 s for requests in flight (05-api 2.4); Railway's drainingSeconds is 60 (.railway/railway.ts).
const stopMetrics = startMetricsFlush();
onShutdown("api", 25_000, () => closeServer(server), async () => {
  await stopMetrics();
  await Promise.allSettled([closeQueues().then(() => redis().quit()), closeDb()]);
});

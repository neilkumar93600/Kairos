import express from "express";
import cors from "cors";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import type { AuthGateway } from "./lib/auth";
import { httpLogger, requestId } from "./lib/logger";
import { clientIpResolver } from "./middleware/client-ip";
import { createLimiters } from "./middleware/rate-limit";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { healthRouter, type HealthCheck } from "./routes/health";
import { apiRouter } from "./routes";
import { webhooksRouter } from "./routes/webhooks";

export interface AppDeps {
  auth: AuthGateway;
  healthChecks: Record<string, HealthCheck>;
  /** Origins allowed to call the API cross-origin. The web app is same-origin via its /api rewrite. */
  corsOrigins: string[];
  /** KAIROS_EDGE_SECRET. Unset: no request is trusted as coming through the web edge (05-api 5.5). */
  edgeSecret?: string;
  /** TRUSTED_PROXY_HOPS_DIRECT: inner proxies between Railway's edge and the api. */
  proxyHops?: number;
  /** Rate-limit counters in Postgres, shared by replicas and kept across deploys. Off: in memory per app (tests). */
  sharedLimits?: boolean;
}

/** Builds the Express app. Order matters: auth and webhooks read the raw body, so they mount before express.json(). */
export function createApp(deps: AppDeps) {
  const app = express();
  const limits = createLimiters(deps.sharedLimits ?? false);
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(requestId);
  // Before the logger, so the edge secret never reaches a log line; req.ip is not used for limits (05-api 5.5).
  app.use(clientIpResolver(deps.edgeSecret, deps.proxyHops));
  app.use(helmet());
  app.use(httpLogger());
  app.use(cors({ origin: deps.corsOrigins, credentials: true, allowedHeaders: ["content-type", "authorization", "x-request-id"], exposedHeaders: ["x-request-id"] }));

  app.use(healthRouter(deps.healthChecks));
  app.all("/api/auth/*splat", toNodeHandler(deps.auth.handler));
  app.use("/api/webhooks", limits.webhook, webhooksRouter);

  app.use(express.json({ limit: "1mb" }));
  app.use("/api", apiRouter(deps.auth, limits));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

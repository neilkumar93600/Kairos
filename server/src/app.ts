import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import type { AuthGateway } from "./lib/auth";
import { HttpError } from "./lib/errors";
import { httpLogger, requestId } from "./lib/logger";
import { signal, type Signal } from "./lib/sentry";
import { clientIpResolver } from "./middleware/client-ip";
import { originGuard } from "./middleware/origin-guard";
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
  /** Exact origins whose cookie-authenticated writes are accepted (05-api 5.6). None: every such write is refused. */
  csrfOrigins?: string[];
  /** KAIROS_EDGE_SECRET. Unset: no request is trusted as coming through the web edge (05-api 5.5). */
  edgeSecret?: string;
  /** TRUSTED_PROXY_HOPS_DIRECT: inner proxies between Railway's edge and the api. */
  proxyHops?: number;
  /** Rate-limit counters in Postgres, shared by replicas and kept across deploys. Off: in memory per app (tests). */
  sharedLimits?: boolean;
  /** True once SIGTERM arrived (lib/lifecycle.ts): /health answers 503 draining. */
  isDraining?: () => boolean;
}

const AUTH_BODY_MAX_BYTES = 64 * 1024;

/**
 * better-call reads a whole /api/auth body with no limit (CISO mustFix 2), and Better Auth's JSON is tiny: refuse over
 * 64 KB, and any body whose length is not declared up front. The connection closes so an unread upload is not drained.
 */
function capAuthBody(req: Request, res: Response, next: NextFunction) {
  const length = req.headers["content-length"];
  const tooLarge = length === undefined ? req.headers["transfer-encoding"] !== undefined : Number(length) > AUTH_BODY_MAX_BYTES;
  if (tooLarge) res.setHeader("connection", "close");
  next(tooLarge ? new HttpError(413, "payload_too_large", "The request body is too large") : undefined);
}

/** Counts responses with one of `statuses` as a security signal for Sentry (lib/sentry.ts). */
const signalOn = (statuses: number[], name: Signal) => (_req: Request, res: Response, next: NextFunction) => {
  res.on("finish", () => statuses.includes(res.statusCode) && signal(name));
  next();
};

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

  app.use(healthRouter(deps.healthChecks, deps.isDraining));
  app.use("/api/auth", signalOn([429], "auth_rate_limited"), capAuthBody);
  app.all("/api/auth/*splat", toNodeHandler(deps.auth.handler));
  app.use("/api/webhooks/inbound-email", signalOn([401, 403], "inbound_token_rejected"));
  app.use("/api/webhooks/postmark-events", signalOn([401, 403], "postmark_events_token_rejected"));
  app.use("/api/webhooks", limits.webhook, webhooksRouter);

  app.use(express.json({ limit: "1mb" }));
  app.use("/api", originGuard(deps.csrfOrigins ?? []), apiRouter(deps.auth, limits));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

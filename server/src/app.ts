import express from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { toNodeHandler } from "better-auth/node";
import type { AuthGateway } from "./lib/auth";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { healthRouter, type HealthCheck } from "./routes/health";
import { apiRouter } from "./routes";
import { webhooksRouter } from "./routes/webhooks";

export interface AppDeps {
  auth: AuthGateway;
  healthChecks: Record<string, HealthCheck>;
  /** Origins allowed to call the API cross-origin. The web app is same-origin via its /api rewrite. */
  corsOrigins: string[];
}

/** Builds the Express app. Order matters: auth and webhooks read the raw body, so they mount before express.json(). */
export function createApp(deps: AppDeps) {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));
  app.use(cors({ origin: deps.corsOrigins, credentials: true, allowedHeaders: ["content-type", "authorization"] }));

  app.use(healthRouter(deps.healthChecks));
  app.all("/api/auth/*splat", toNodeHandler(deps.auth.handler));
  app.use("/api/webhooks", webhooksRouter);

  app.use(express.json({ limit: "1mb" }));
  app.use("/api", apiRouter(deps.auth));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

import { Router } from "express";
import { healthStatus, type HealthCheck } from "../lib/lifecycle";

export type { HealthCheck };

/**
 * GET /health (Railway's healthcheck, the direct uptime check) and GET /api/health (the same handler through the web's
 * /api rewrite, so the second uptime check proves the Vercel path too). 200 when every dependency answers within 3 s,
 * 503 otherwise or while draining. Status only: the failed check is in the log, not the response.
 */
export function healthRouter(checks: Record<string, HealthCheck>, isDraining: () => boolean = () => false) {
  const router = Router();
  router.get(["/health", "/api/health"], async (_req, res) => {
    const [status, body] = await healthStatus(checks, isDraining());
    res.status(status).json(body);
  });
  return router;
}

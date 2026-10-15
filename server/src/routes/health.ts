import { Router } from "express";

export type HealthCheck = () => Promise<void>;

/** GET /health: 200 when every dependency answers, 503 otherwise. Railway uses it as the healthcheck. */
export function healthRouter(checks: Record<string, HealthCheck>) {
  const router = Router();
  router.get("/health", async (_req, res) => {
    const results = await Promise.all(
      Object.entries(checks).map(async ([name, check]) => {
        try {
          await Promise.race([check(), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))]);
          return [name, "ok"] as const;
        } catch {
          return [name, "down"] as const;
        }
      }),
    );
    const ok = results.every(([, status]) => status === "ok");
    res.status(ok ? 200 : 503).json({ status: ok ? "ok" : "degraded", checks: Object.fromEntries(results) });
  });
  return router;
}

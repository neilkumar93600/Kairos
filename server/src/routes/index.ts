import { Router } from "express";
import { configuredProviders, type AuthGateway } from "../lib/auth";
import { env } from "../lib/env";
import { requireAuth } from "../middleware/require-auth";
import { countFailedSignIn, type Limiters } from "../middleware/rate-limit";
import { applicationsRouter } from "./applications";
import { billingRouter } from "./billing";
import { contactRouter } from "./contact";
import { creditsRouter } from "./credits";
import { extensionRouter } from "./extension";
import { inboxRouter } from "./inbox";
import { jobsRouter } from "./jobs";
import { matchesRouter } from "./matches";
import { meRouter } from "./me";
import { profileRouter } from "./profile";
import { resumeRouter } from "./resume";

/** Every JSON route under /api. Auth routes (/api/auth/*) and webhooks are mounted separately in app.ts. */
export function apiRouter(gateway: AuthGateway, limits: Limiters) {
  const router = Router();
  router.use(limits.anon);

  router.use("/contact", limits.contact, contactRouter);
  router.get("/auth-providers", (_req, res) => {
    res.set("cache-control", "public, max-age=300").json({ providers: configuredProviders(env()) });
  });

  const authed = [requireAuth(gateway), limits.user];
  router.use("/me", authed, meRouter);
  router.use("/profile", authed, profileRouter);
  router.use("/matches", authed, matchesRouter);
  router.use("/jobs", authed, jobsRouter);
  router.use("/resume", authed, resumeRouter);
  router.use("/applications", authed, applicationsRouter);
  router.use("/credits", authed, creditsRouter);
  router.use("/inbox", authed, inboxRouter);
  router.use("/billing", authed, limits.billing, billingRouter);
  router.use("/extension", authed, extensionRouter);
  router.use(countFailedSignIn(limits));
  return router;
}

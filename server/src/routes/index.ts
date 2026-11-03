import { Router, type RequestHandler } from "express";
import { configuredProviders, type AuthGateway } from "../lib/auth";
import { env } from "../lib/env";
import { routeDeadline } from "../middleware/deadline";
import { requireAuth } from "../middleware/require-auth";
import { countFailedSignIn, type Limiters } from "../middleware/rate-limit";
import { applicationsRouter } from "./applications";
import { billingRouter } from "./billing";
import { contactRouter } from "./contact";
import { creditsRouter } from "./credits";
import { extensionRouter } from "./extension";
import { filesRouter } from "./files";
import { inboxRouter } from "./inbox";
import { jobsRouter } from "./jobs";
import { matchesRouter } from "./matches";
import { meRouter } from "./me";
import { profileRouter } from "./profile";
import { resumeRouter } from "./resume";

/** Every JSON route under /api. Auth routes (/api/auth/*) and webhooks are mounted separately in app.ts. */
export function apiRouter(gateway: AuthGateway, limits: Limiters) {
  const router = Router();
  router.use(routeDeadline, limits.anon);

  router.use("/contact", limits.contact, contactRouter);
  router.get("/auth-providers", (_req, res) => {
    res.set("cache-control", "public, max-age=300").json({ providers: configuredProviders(env()) });
  });

  // A signed-in answer is never kept by a browser or shared cache, errors included (CISO should-fix "no-store").
  const noStore: RequestHandler = (_req, res, next) => {
    res.set("cache-control", "private, no-store");
    next();
  };
  const authed = [requireAuth(gateway), limits.user, noStore];
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
  router.use("/files", authed, filesRouter);
  router.use(countFailedSignIn(limits));
  return router;
}

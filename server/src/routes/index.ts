import { Router } from "express";
import type { AuthGateway } from "../lib/auth";
import { requireAuth } from "../middleware/require-auth";
import { apiLimiter } from "../middleware/rate-limit";
import { applicationsRouter } from "./applications";
import { billingRouter } from "./billing";
import { contactRouter } from "./contact";
import { creditsRouter } from "./credits";
import { extensionRouter } from "./extension";
import { inboxRouter } from "./inbox";
import { matchesRouter } from "./matches";
import { meRouter } from "./me";
import { profileRouter } from "./profile";

/** Every JSON route under /api. Auth routes (/api/auth/*) and webhooks are mounted separately in app.ts. */
export function apiRouter(gateway: AuthGateway) {
  const router = Router();
  router.use(apiLimiter);

  router.use("/contact", contactRouter);

  const authed = requireAuth(gateway);
  router.use("/me", authed, meRouter);
  router.use("/profile", authed, profileRouter);
  router.use("/matches", authed, matchesRouter);
  router.use("/applications", authed, applicationsRouter);
  router.use("/credits", authed, creditsRouter);
  router.use("/inbox", authed, inboxRouter);
  router.use("/billing", authed, billingRouter);
  router.use("/extension", authed, extensionRouter);
  return router;
}

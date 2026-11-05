import { Router, type RequestHandler } from "express";
import { configuredProviders, type AuthGateway } from "../lib/auth";
import { env } from "../lib/env";
import { requireAdmin } from "../middleware/require-admin";
import { routeDeadline } from "../middleware/deadline";
import { requireAuth } from "../middleware/require-auth";
import { countFailedSignIn, type Limiters } from "../middleware/rate-limit";
import { adminRouter } from "./admin";
import { applicationsRouter } from "./applications";
import { billingRouter } from "./billing";
import { contactRouter } from "./contact";
import { creditsRouter } from "./credits";
import { extensionRouter } from "./extension";
import { signedLinkRouter } from "./links";
import { resendLinkAction } from "./resend-link";
import { filesRouter } from "./files";
import { forwardingRouter } from "./forwarding";
import { importsRouter } from "./imports";
import { inboxRouter } from "./inbox";
import { jobsRouter } from "./jobs";
import { matchesRouter } from "./matches";
import { meRouter } from "./me";
import { newsletterRouter } from "./newsletter";
import { notificationsRouter } from "./notifications";
import { emailPreferencesRouter } from "./preferences";
import { profileRouter } from "./profile";
import { resumeRouter } from "./resume";
import { resumesRouter } from "./resumes";
import { savedSearchesRouter } from "./saved-searches";
import { unsubscribeRouter } from "./unsubscribe";

/** Every JSON route under /api. Auth routes (/api/auth/*) and webhooks are mounted separately in app.ts. */
export function apiRouter(gateway: AuthGateway, limits: Limiters) {
  const router = Router();
  // Signed-link pages (routes/links.ts): the token is the credential, so they sit above the anonymous limiter and behind their own class.
  // The per-address limit guards the GET page; a mail client's one-click POST comes from Gmail's or Yahoo's shared addresses,
  // where a burst would 429 real unsubscribes. A POST costs a signature check first and reaches the database only for a signed token.
  router.use("/unsubscribe", routeDeadline, (req, res, next) => (req.method === "POST" ? next() : limits.link(req, res, next)), unsubscribeRouter);
  // The signed resend link (05-api 10.4): the token is the credential, and it must stay above the session chain below.
  router.use("/applications/:id/resend-link", routeDeadline, limits.link, signedLinkRouter(resendLinkAction));
  // Public newsletter (WP-50): its own classes per route (routes/newsletter.ts), ahead of the anonymous class.
  router.use("/newsletter", routeDeadline, newsletterRouter(limits));
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
  // Session-fresh routes (05-api 5.2 lists them): the session is read once, without the cookie cache, and must be under a
  // day old. Flag the route's authz-matrix entry `fresh: true`; the matrix test fails if the flag and the mount disagree.
  // Billing always enforces the age. Approve enforces it only under FRESH_SESSION_ENFORCE (the web has no sign-in-again
  // flow yet), but always reads the session uncached.
  const freshAuthed = [requireAuth(gateway, "session-fresh"), limits.user, noStore];
  const approveAuthed = [
    requireAuth(gateway, (req) => (req.method === "POST" && (req.path === "/approve" || /^\/[^/]+\/resend$/.test(req.path)) ? "session-fresh" : "session"), { enforceAge: () => env().FRESH_SESSION_ENFORCE }),
    limits.user,
    noStore,
  ];
  router.use("/me", authed, meRouter);
  // Before /profile, so an import meets requireAuth and the limits once (WP-17).
  router.use("/profile/imports", authed, limits.upload, importsRouter);
  router.use("/profile", authed, profileRouter);
  router.use("/matches", authed, matchesRouter);
  router.use("/jobs", authed, jobsRouter);
  router.use("/resume", authed, resumeRouter);
  router.use("/applications", approveAuthed, applicationsRouter);
  router.use("/credits", authed, creditsRouter);
  router.use("/inbox", authed, inboxRouter);
  router.use("/forwarding", authed, forwardingRouter);
  router.use("/billing", freshAuthed, limits.billing, billingRouter);
  router.use("/extension", authed, extensionRouter);
  router.use("/files", authed, filesRouter);
  router.use("/resumes", authed, resumesRouter);
  router.use("/admin", requireAdmin(gateway), limits.user, noStore, adminRouter);
  router.use("/notifications", authed, notificationsRouter);
  router.use("/email-preferences", authed, emailPreferencesRouter);
  router.use("/saved-searches", authed, savedSearchesRouter);
  router.use(countFailedSignIn(limits));
  return router;
}

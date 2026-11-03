import { Router, type Request, type Response } from "express";
import { newsletterSignupSchema, type NewsletterSignup } from "@auto-career/shared";
import { enqueueNotify } from "../jobs/notify";
import { HttpError } from "../lib/errors";
import { validateBody } from "../middleware/validate";
import type { Limiters } from "../middleware/rate-limit";
import { confirmSubscription, newsletterPage, signUp, unsubscribe, type NewsletterStatus } from "../services/newsletter";

/**
 * The newsletter (WP-50; marketing-surfaces spec, Backend contract), no sign-in. Mounted at /api/newsletter in
 * routes/index.ts ahead of the anonymous class: the sign-up meets the newsletter class (5 an hour per client IP, the
 * contact form's numbers), the token links the signed-link class (20 a minute per IP).
 *
 *  - POST /        { email, source, website? } -> 202 { ok: true } for every valid body, whatever the address's state.
 *  - GET  /confirm?token=      -> 303 to WEB_ORIGIN/newsletter?status=confirmed|invalid
 *  - GET  /unsubscribe?token=  -> 303 to WEB_ORIGIN/newsletter?status=unsubscribed|invalid
 *  - POST /unsubscribe?token=  -> 200 { ok: true } (RFC 8058 one-click: no redirect, no cookie needed; 404 for an unknown token)
 *
 * A HEAD on either link answers 204 and changes nothing (Express would otherwise run the GET handler for it).
 */
export function newsletterRouter(limits: Limiters): Router {
  const router = Router();

  router.post("/", limits.newsletter, validateBody(newsletterSignupSchema), async (req, res) => {
    const { email, source, website } = req.body as NewsletterSignup;
    // The honeypot: a hidden field people leave empty. A bot that fills it gets the same answer and nothing is stored.
    if (!website) await enqueueNotify("newsletter_confirm", await signUp(email, source), null);
    res.status(202).json({ ok: true });
  });

  const toPage = (res: Response, status: NewsletterStatus) =>
    res.set({ "cache-control": "no-store", "referrer-policy": "no-referrer" }).redirect(303, newsletterPage(status));
  const headOnly = (req: Request, res: Response) => req.method === "HEAD" && (res.status(204).end(), true);

  router.get("/confirm", limits.link, async (req, res) => {
    if (headOnly(req, res)) return;
    toPage(res, (await confirmSubscription(req.query.token)) ? "confirmed" : "invalid");
  });

  router.get("/unsubscribe", limits.link, async (req, res) => {
    if (headOnly(req, res)) return;
    toPage(res, (await unsubscribe(req.query.token)) ? "unsubscribed" : "invalid");
  });

  // RFC 8058: the mail provider posts "List-Unsubscribe=One-Click" to the header's URL, without cookies, and does not
  // follow redirects. The token in the query string is the whole credential; the body is not read.
  router.post("/unsubscribe", limits.link, async (req, res) => {
    if (!(await unsubscribe(req.query.token))) throw new HttpError(404, "not_found", "This unsubscribe link is not valid");
    res.set("cache-control", "no-store").json({ ok: true });
  });

  return router;
}

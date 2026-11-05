import { Router } from "express";
import { newsletterSignupSchema, type NewsletterSignup } from "@auto-career/shared";
import { enqueueNotify } from "../jobs/notify";
import { emailLimitId } from "../lib/auth";
import { HttpError } from "../lib/errors";
import { hit, type Limiters } from "../middleware/rate-limit";
import { validateBody } from "../middleware/validate";
import { confirmSubscription, signUp, unsubscribe, unsubscribeRedirect } from "../services/newsletter";

/**
 * The newsletter (WP-50; marketing-surfaces spec, Backend contract), no sign-in. Mounted at /api/newsletter in
 * routes/index.ts ahead of the anonymous class. Limits: the sign-up meets the newsletter class (20 an hour per client IP)
 * and a cap per address below; POST /unsubscribe the newsletter_one_click class (300 a minute per IP, because mail
 * providers post from a few addresses); confirm and GET /unsubscribe the signed-link class (20 a minute per IP).
 *
 *  - POST /                    { email, source, website? } -> 202 { ok: true } for every valid body, whatever the address's state
 *  - POST /confirm?token=      -> 200 { ok: true }, or 404 for an unknown, used or expired token
 *  - POST /unsubscribe?token=  -> 200 { ok: true }, or 404 for an unknown token (RFC 8058: no redirect, no cookie needed)
 *  - GET  /unsubscribe?token=  -> 303 to the web page that POSTs it. Changes nothing and reads nothing: mail scanners open
 *    every link. It is there for clients that GET the List-Unsubscribe URL. There is no GET /confirm.
 */

/**
 * Sign-ups per address per day, from any number of IPs: past it the answer is the same 202 and nothing happens, so a
 * stranger cannot keep mailing one inbox, and the row is left alone, so a pending one still ages out. The count is of
 * requests under the normalized address, never of its state, so it says nothing about the list. Here and not in
 * services/newsletter.ts because only the api writes rate_limits; the worker loads that service to render the mail.
 */
const ADDRESS_CAP = 5;
const overAddressCap = async (email: string) => (await hit(`newsletter_addr:${emailLimitId(email)}`, 86_400_000)).count > ADDRESS_CAP;

export function newsletterRouter(limits: Limiters): Router {
  const router = Router();

  router.post("/", limits.newsletter, validateBody(newsletterSignupSchema), async (req, res) => {
    const { email, source, website } = req.body as NewsletterSignup;
    // The honeypot: a hidden field people leave empty. A bot that fills it gets the same answer and nothing is stored.
    if (!website && !(await overAddressCap(email))) await enqueueNotify("newsletter_confirm", await signUp(email, source), null);
    res.status(202).json({ ok: true });
  });

  router.post("/confirm", limits.link, async (req, res) => {
    if (!(await confirmSubscription(req.query.token))) throw new HttpError(404, "not_found", "This confirmation link is not valid");
    res.set("cache-control", "no-store").json({ ok: true });
  });

  // The token in the query string is the whole credential; the body ("List-Unsubscribe=One-Click") is not read.
  router.post("/unsubscribe", limits.newsletterOneClick, async (req, res) => {
    if (!(await unsubscribe(req.query.token))) throw new HttpError(404, "not_found", "This unsubscribe link is not valid");
    res.set("cache-control", "no-store").json({ ok: true });
  });

  router.get("/unsubscribe", limits.link, (req, res) => {
    res.set({ "cache-control": "no-store", "referrer-policy": "no-referrer" }).redirect(303, unsubscribeRedirect(req.query.token));
  });

  return router;
}

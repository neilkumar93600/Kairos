import express, { Router, type Request, type Response } from "express";
import { db } from "../db/client";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { consumeActionToken, peekActionToken, verifyLink, type LinkTarget, type StoredPurpose } from "../lib/action-tokens";

type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];

/** What a signed-link page shows. Plain text: every field is HTML-escaped. */
export interface LinkPage {
  title: string;
  body: string;
  /** The form's button. Absent on a result page, which has no form. */
  button?: string;
}

/**
 * One signed-link action (05-api 10.4, arch B.6.10): a page on GET that only reads, and the action on POST.
 * `show` and `act` get the request (path params, form fields) and the link's target; `act` runs inside the transaction
 * that used the link up, so a thrown error rolls both back and the link stays usable.
 */
export interface LinkAction {
  purpose: StoredPurpose;
  /**
   * RFC 8058 one-click (unsubscribe only): the POST may carry the token in the query string, as a mail client's
   * List-Unsubscribe-Post does. Off for everything else, so a scanner replaying the emailed GET URL as a POST cannot
   * resend an application or undo an offer pause; those need the form's own field.
   */
  oneClick?: true;
  show(target: LinkTarget, req: Request): Promise<LinkPage | null>;
  act(tx: Tx, target: LinkTarget, req: Request): Promise<LinkPage | null>;
}

/** Response headers of every signed-link page: no script, no framing, no referrer, nothing cached (05-api 10.4). */
const PAGE_HEADERS = {
  "content-security-policy": "default-src 'none'; form-action 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'",
  "referrer-policy": "no-referrer",
  "cache-control": "private, no-store",
  "x-frame-options": "DENY",
  "content-type": "text/html; charset=utf-8",
};

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

const EXPIRED: LinkPage = { title: "This link has expired", body: "It was already used, or it is too old. Open Kairos to continue." };

function render(res: Response, status: number, page: LinkPage, token?: string) {
  const form = page.button && token
    ? `<form method="post"><input type="hidden" name="t" value="${escapeHtml(token)}"><button type="submit">${escapeHtml(page.button)}</button></form>`
    : "";
  res
    .status(status)
    .set(PAGE_HEADERS)
    .send(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<title>${escapeHtml(page.title)}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem}</style></head>` +
        `<body><h1>${escapeHtml(page.title)}</h1><p>${escapeHtml(page.body)}</p>${form}</body></html>`,
    );
}

const tokenOf = (v: unknown) => (typeof v === "string" ? v : "");
/** No key: every link is refused with the same page, logged once per request, never a 500 that says why. */
const keyMissing = () => {
  if (env().LINK_SIGNING_KEY) return false;
  logger.error("LINK_SIGNING_KEY is not set: signed links answer 410");
  return true;
};
const REFUSED = new Error("signed link refused");

/**
 * The GET page and the POST action of one signed link. A malformed, forged, used, expired or unknown token gets the
 * same 410 page (link_expired), and so does a target the action refuses (`show`/`act` returning null).
 *
 * Mounting (WP-29, WP-35): in routes/index.ts, above `router.use(routeDeadline, limits.anon)`, so the anonymous class never
 * counts link traffic, with the deadline repeated on the mount, outside the session chain and behind the `link` class
 * (05-api 6.2). The default 10 s deadline fits both pages, so ROUTE_DEADLINES needs no row:
 *   router.use("/unsubscribe", routeDeadline, limits.link, signedLinkRouter(unsubscribeAction));
 *   router.use("/applications/:id/resend-link", routeDeadline, limits.link, signedLinkRouter(resendAction));
 * Each mounted path needs a `public` entry in test/helpers/authz-matrix.ts ("the signed token is the credential; GET only
 * reads"). `limits.link` is created but deliberately mounted nowhere until the first such route exists.
 */
export function signedLinkRouter(action: LinkAction): Router {
  const router = Router({ mergeParams: true });

  router.get("/", async (req, res) => {
    const token = tokenOf(req.query.t);
    if (keyMissing()) return render(res, 410, EXPIRED);
    const target = await peekActionToken(db(), token, action.purpose);
    const page = target && (await action.show(target, req));
    if (!page) return render(res, 410, EXPIRED);
    render(res, 200, page, token);
  });

  // The form posts `t` as a field; only a one-click action also reads it from the query string.
  router.post("/", express.urlencoded({ extended: false, limit: "2kb", parameterLimit: 10 }), async (req, res) => {
    const token = tokenOf(req.body?.t) || (action.oneClick ? tokenOf(req.query.t) : "");
    if (keyMissing()) return render(res, 410, EXPIRED);
    // A forged token never opens a transaction or touches the database.
    if (!verifyLink(token, action.purpose)) return render(res, 410, EXPIRED);
    const page = await db()
      .transaction(async (tx) => {
        const target = await consumeActionToken(tx, token, action.purpose);
        const done = target && (await action.act(tx, target, req));
        // A refused target rolls the use back too: the link was not the right one for this page, so it stays usable.
        if (!done) throw REFUSED;
        return done;
      })
      .catch((err: unknown) => {
        if (err === REFUSED) return null;
        throw err;
      });
    render(res, page ? 200 : 410, page ?? EXPIRED);
  });

  return router;
}

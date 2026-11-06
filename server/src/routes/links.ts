import express, { Router, type Request, type Response } from "express";
import { db } from "../db/client";
import { env } from "../lib/env";
import { escapeHtml } from "../lib/html";
import { logger } from "../lib/logger";
import { hit } from "../middleware/rate-limit";
import { consumeActionToken, peekActionToken, tokenHash, verifyLink, type LinkTarget, type StoredPurpose } from "../lib/action-tokens";

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
  /**
   * The link is not used up: GET and POST check the signature and that the row exists and has not expired, and ignore
   * used_at. Only for an action that is idempotent and only ever turns one thing off (unsubscribe), so single use protects
   * nothing and a second click (a client's one-click POST, then the footer link, then a refresh) must still succeed.
   */
  reusable?: true;
  /** The 410 page for this action, when the generic "expired" one would mislead (unsubscribe: "already used" mostly means done). */
  gone?: LinkPage | (() => LinkPage);
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

export { escapeHtml };

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

/** Thrown by `act`: the action cannot run now and the page says why. Rolls the link's use back too, so it still works after the user acts on the page. */
export class LinkRefusal extends Error {
  constructor(public readonly page: LinkPage) {
    super("signed link action refused");
  }
}

/**
 * A reusable link is not used up, so a valid token's POST would otherwise cost a transaction, about five statements and a
 * profile row lock on every call, unmetered, for the token's 90 days. They are counted per token instead of per address,
 * so Gmail's and Yahoo's shared servers are never punished: 10 an hour per token, where a legitimate person makes about
 * three (the client's one-click POST, the footer link, a refresh). Counted only after the signature verified, so forged
 * tokens never touch the limiter table; single-use links need no limit, their first use ends them.
 */
const REUSABLE_POSTS_PER_HOUR = 10;
const HOUR_MS = 3_600_000;

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
  const gonePage = (): LinkPage => (typeof action.gone === "function" ? action.gone() : (action.gone ?? EXPIRED));

  router.get("/", async (req, res) => {
    const token = tokenOf(req.query.t);
    if (keyMissing()) return render(res, 410, gonePage());
    const target = await peekActionToken(db(), token, action.purpose, undefined, action.reusable === true);
    const page = target && (await action.show(target, req));
    if (!page) return render(res, 410, gonePage());
    render(res, 200, page, token);
  });

  // The form posts `t` as a field; only a one-click action also reads it from the query string.
  router.post("/", express.urlencoded({ extended: false, limit: "2kb", parameterLimit: 10 }), async (req, res) => {
    const token = tokenOf(req.body?.t) || (action.oneClick ? tokenOf(req.query.t) : "");
    if (keyMissing()) return render(res, 410, gonePage());
    // A forged token never opens a transaction or touches the database.
    if (!verifyLink(token, action.purpose)) return render(res, 410, gonePage());
    if (action.reusable) {
      const { count, resetAt } = await hit(`link:${tokenHash(token).toString("hex")}`, HOUR_MS);
      if (count > REUSABLE_POSTS_PER_HOUR) {
        res.set("retry-after", String(Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))));
        return render(res, 429, { title: "Too many tries", body: "This link was used many times in a short while. Try again in an hour, or turn the emails off in Kairos under Settings." });
      }
    }
    const page = await db()
      .transaction(async (tx) => {
        const target = action.reusable ? await peekActionToken(tx, token, action.purpose, undefined, true) : await consumeActionToken(tx, token, action.purpose);
        const done = target && (await action.act(tx, target, req));
        // A refused target rolls the use back too: the link was not the right one for this page, so it stays usable.
        if (!done) throw REFUSED;
        return done;
      })
      .catch((err: unknown) => {
        if (err === REFUSED) return null;
        if (err instanceof LinkRefusal) return err.page;
        throw err;
      });
    render(res, page ? 200 : 410, page ?? gonePage());
  });

  return router;
}

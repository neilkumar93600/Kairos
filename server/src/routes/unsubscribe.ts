import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { MAIL_OPT_OUTS, profiles } from "../db/schema";
import { OPT_OUT_LABEL } from "../lib/broadcast";
import { env } from "../lib/env";
import { setMailKind } from "../services/mail-preferences";
import { signedLinkRouter, type LinkAction } from "./links";

/**
 * GET and POST /api/unsubscribe?t= (messaging-55, 05-api 12.1, RFC 8058). The link in every broadcast email: GET shows
 * what will stop and changes nothing (a mail scanner opens it), the form's POST acts, and a mail client's one-click
 * button POSTs to the emailed URL itself (`oneClick`, the only link action allowed to read the token from the query).
 * Turning a kind off is naturally idempotent. Account mail (codes, receipts, resend links) has no unsubscribe.
 * Mounted in routes/index.ts above the anonymous limiter, behind the `link` class.
 */
const keyOf = (entityId: string) => ((MAIL_OPT_OUTS as readonly string[]).includes(entityId) ? (entityId as (typeof MAIL_OPT_OUTS)[number]) : null);

/**
 * SECURITY: this action may only ever turn a kind OFF. `reusable` is safe because of that and only that: a 90-day token
 * that works on every click, sitting in a forwarded mail, can at worst stop mail the holder could stop anyway. If this
 * page ever turned a kind back on (a "resubscribe" button, an undo), a reusable token would become a capability leak:
 * give that action its own single-use purpose through consumeActionToken instead. `reusable` is opt-in per action like
 * `oneClick`; resend and offer-pause undo spend money and keep single use (test/links.int.test.ts pins their 410).
 */
export const unsubscribeAction: LinkAction = {
  purpose: "unsubscribe",
  oneClick: true,
  // Turning a kind off is idempotent, so the link is not used up: Gmail's one-click POST, the footer link and a refresh
  // all answer "You are unsubscribed" (05-api 12.1: a second click shows "already unsubscribed").
  reusable: true,
  gone: () => ({
    title: "This unsubscribe link no longer works",
    body: `It is too old or not valid. If you still get these emails, turn them off in Kairos under Settings: ${env().WEB_ORIGIN}/settings`,
  }),
  async show(target) {
    const key = keyOf(target.entityId);
    if (!key) return null;
    const [p] = await db().select({ optOut: profiles.mailOptOut }).from(profiles).where(eq(profiles.userId, target.userId));
    if (!p) return null;
    return p.optOut.includes(key)
      ? { title: "You are already unsubscribed", body: `You do not get ${OPT_OUT_LABEL[key]}. Nothing to change.` }
      : { title: "Unsubscribe", body: `Stop ${OPT_OUT_LABEL[key]}? Account emails such as sign-in codes and receipts keep coming.`, button: "Unsubscribe" };
  },
  async act(tx, target) {
    const key = keyOf(target.entityId);
    if (!key) return null;
    await setMailKind(tx, target.userId, key, false);
    return { title: "You are unsubscribed", body: `You will not get ${OPT_OUT_LABEL[key]} any more. You can turn it back on in Kairos under Settings.` };
  },
};

export const unsubscribeRouter = signedLinkRouter(unsubscribeAction);

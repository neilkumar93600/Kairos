import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { consentRecords, erasedEmails, MAIL_OPT_OUTS, profiles, savedSearches, subscriptions, user } from "../db/schema";
import { CONSENT_PURPOSE } from "../lib/broadcast";
import { env } from "../lib/env";
import { grantFreeCredits } from "./credits";
import { emailHashIfKeyed } from "./erasure";
import { keptOptOuts } from "./mail-preferences";

function forwardingAddressFor(userId: string): string {
  const suffix = randomBytes(4).toString("hex");
  return `u-${userId.slice(0, 8).toLowerCase()}-${suffix}@${env().INBOUND_EMAIL_DOMAIN}`;
}

/**
 * What every new user gets, in one transaction: a profile, a free subscriptions row, the free grant (unless the address
 * belonged to an erased account) and the sign-up consent record. Each insert is
 * a no-op when its row exists (the profile and plan keys, the one-free-grant index), so the sign-up hook and the
 * bootstrap-users reconciler can both run it, at once or again. Returns whether it wrote anything.
 */
export async function bootstrapUser(db: Db, userId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [account] = await tx.select({ email: user.email }).from(user).where(eq(user.id, userId));
    const mailHash = account ? emailHashIfKeyed(account.email) : null;
    // The optional mail kinds start off until the person consents (MAIL_CONSENT_DEFAULT, owner-actions/WP-35.md).
    // An address that objected before (even through an erased account) stays opted out of those kinds.
    const kept = account ? await keptOptOuts(tx, account.email) : new Set<(typeof MAIL_OPT_OUTS)[number]>();
    const optIn = env().MAIL_CONSENT_DEFAULT === "opt_in";
    const wanted = optIn ? MAIL_OPT_OUTS.filter((k) => !kept.has(k)) : [];
    const profile = await tx
      .insert(profiles)
      .values({ userId, forwardingAddress: forwardingAddressFor(userId), preferences: null, normalizedEmailHash: mailHash, mailOptOut: MAIL_OPT_OUTS.filter((k) => !wanted.includes(k)) })
      .onConflictDoNothing({ target: profiles.userId })
      .returning({ userId: profiles.userId });
    if (profile.length) {
      // The default digest search (B-4); only with a new profile, so a person who deleted it does not get it back.
      await tx.insert(savedSearches).values({ userId, name: "My matches" }).onConflictDoNothing();
      if (wanted.length) {
        await tx.insert(consentRecords).values(wanted.map((key) => ({ userId, purpose: CONSENT_PURPOSE[key], version: env().PRIVACY_NOTICE_VERSION }))).onConflictDoNothing();
      }
    }
    const plan = await tx.insert(subscriptions).values({ userId, plan: "free" }).onConflictDoNothing({ target: subscriptions.userId }).returning({ userId: subscriptions.userId });
    // An address an erased account used gets no second free grant (WP-25, CISO should-fix deletion).
    const erased = mailHash ? (await tx.select().from(erasedEmails).where(eq(erasedEmails.emailHash, mailHash))).length > 0 : false;
    const granted = erased ? false : await grantFreeCredits(tx, userId);
    // The terms and privacy notice the sign-up form showed (api-auth-security-54).
    await tx.insert(consentRecords).values({ userId, purpose: "terms_privacy", version: env().PRIVACY_NOTICE_VERSION }).onConflictDoNothing();
    return profile.length + plan.length > 0 || granted;
  });
}

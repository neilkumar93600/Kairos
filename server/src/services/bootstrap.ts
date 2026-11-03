import { randomBytes } from "node:crypto";
import type { Db } from "../db/client";
import { profiles, subscriptions } from "../db/schema";
import { env } from "../lib/env";
import { grantFreeCredits } from "./credits";

function forwardingAddressFor(userId: string): string {
  const suffix = randomBytes(4).toString("hex");
  return `u-${userId.slice(0, 8).toLowerCase()}-${suffix}@${env().INBOUND_EMAIL_DOMAIN}`;
}

/**
 * What every new user gets, in one transaction: a profile, a free subscriptions row and the free grant. Each insert is
 * a no-op when its row exists (the profile and plan keys, the one-free-grant index), so the sign-up hook and the
 * bootstrap-users reconciler can both run it, at once or again. Returns whether it wrote anything.
 */
export async function bootstrapUser(db: Db, userId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const profile = await tx
      .insert(profiles)
      .values({ userId, forwardingAddress: forwardingAddressFor(userId), preferences: null })
      .onConflictDoNothing({ target: profiles.userId })
      .returning({ userId: profiles.userId });
    const plan = await tx.insert(subscriptions).values({ userId, plan: "free" }).onConflictDoNothing({ target: subscriptions.userId }).returning({ userId: subscriptions.userId });
    const granted = await grantFreeCredits(tx, userId);
    return profile.length + plan.length > 0 || granted;
  });
}

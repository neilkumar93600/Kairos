import { Router } from "express";
import { eq } from "drizzle-orm";
import { getPlan } from "@auto-career/shared";
import { db } from "../db/client";
import { profiles, subscriptions } from "../db/schema";
import { publicPlan, SUBSCRIPTION_COLUMNS } from "../lib/serializers";
import { currentUser } from "../middleware/require-auth";
import { availableCredits, countInFlight, getBalance } from "../services/credits";
import { planFor } from "../services/submissions";
import { unreadCount } from "./notifications";

/** GET /api/me: who is signed in, their plan, credits and onboarding step. */
export const meRouter = Router();

meRouter.get("/", async (req, res) => {
  const me = currentUser(req);
  // Independent reads, in parallel (each takes its own pooled connection).
  const [[profile], [subscription], planId, balance, inFlight, unread] = await Promise.all([
    db().select({ onboardingStep: profiles.onboardingStep, forwardingAddress: profiles.forwardingAddress }).from(profiles).where(eq(profiles.userId, me.id)),
    db().select(SUBSCRIPTION_COLUMNS).from(subscriptions).where(eq(subscriptions.userId, me.id)),
    planFor(db(), me.id),
    getBalance(db(), me.id),
    countInFlight(db(), me.id),
    unreadCount(me.id),
  ]);
  res.json({
    user: me,
    plan: publicPlan(getPlan(planId)),
    subscription: subscription ?? null,
    credits: { balance, inFlight, available: availableCredits(balance, inFlight) },
    onboardingStep: profile?.onboardingStep ?? "resume",
    forwardingAddress: profile?.forwardingAddress ?? null,
    // Additive (05-api 12.1): the bell's badge without a second request.
    unreadNotifications: unread,
  });
});

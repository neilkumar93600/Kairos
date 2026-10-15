import { Router } from "express";
import { eq } from "drizzle-orm";
import { getPlan } from "@auto-career/shared";
import { db } from "../db/client";
import { profiles, subscriptions } from "../db/schema";
import { currentUser } from "../middleware/require-auth";
import { availableCredits, countInFlight, getBalance } from "../services/credits";
import { planFor } from "../services/submissions";

/** GET /api/me: who is signed in, their plan, credits and onboarding step. */
export const meRouter = Router();

meRouter.get("/", async (req, res) => {
  const me = currentUser(req);
  const [profile] = await db().select().from(profiles).where(eq(profiles.userId, me.id));
  const [subscription] = await db().select().from(subscriptions).where(eq(subscriptions.userId, me.id));
  const planId = await planFor(db(), me.id);
  const balance = await getBalance(db(), me.id);
  const inFlight = await countInFlight(db(), me.id);
  res.json({
    user: me,
    plan: getPlan(planId),
    subscription: subscription ?? null,
    credits: { balance, inFlight, available: availableCredits(balance, inFlight) },
    onboardingStep: profile?.onboardingStep ?? "resume",
    forwardingAddress: profile?.forwardingAddress ?? null,
  });
});

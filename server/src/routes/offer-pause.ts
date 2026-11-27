import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import type { OfferPauseResume, OfferPauseStatusResponse } from "@auto-career/shared";
import { db } from "../db/client";
import { offerPauseCandidates } from "../db/schema";
import { getFlags } from "../lib/flags";
import { cancelOfferPause, offerPauseStatus, resumeOfferPause } from "../jobs/offer-pause";
import { currentUser } from "../middleware/require-auth";
import { LinkRefusal, type LinkAction, type LinkPage } from "./links";

/**
 * Offer pause routes (WP-33, 05-api billing.offerPause.*).
 *  - GET|POST /api/billing/offer-pause/undo: the emailed signed link. GET only reads; POST uses the token up and cancels
 *    the pending pause. The link lives until the pause is due (48 h, lib/action-tokens.ts), and the cancel is again
 *    conditional on apply_after > now(), so an undo after the window is refused.
 *  - GET /api/billing/offer-pause and POST /api/billing/offer-pause/resume: signed in, the caller's own rows only (INV-11).
 *    Resume is "keep applying": it cancels a pending pause and clears the one in force.
 */

const what = async () => `stop sending new applications${(await getFlags()).offerPauseStripe ? " and pause your billing" : ""}`;
const utc = (d: Date) => `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;

async function pending(candidateId: string, userId: string) {
  const [row] = await db()
    .select({ applyAfter: offerPauseCandidates.applyAfter })
    .from(offerPauseCandidates)
    .where(and(eq(offerPauseCandidates.id, candidateId), eq(offerPauseCandidates.userId, userId), eq(offerPauseCandidates.state, "pending"), sql`${offerPauseCandidates.applyAfter} > now()`));
  return row;
}

export const offerPauseUndoAction: LinkAction = {
  purpose: "offer_pause_undo",
  async show(target): Promise<LinkPage | null> {
    const row = await pending(target.entityId, target.userId);
    if (!row) return null;
    return {
      title: "Keep applying?",
      body: `A reply that looks like a job offer arrived, so on ${utc(row.applyAfter)} Kairos will ${await what()}. If you are still looking, press the button and nothing is paused.`,
      button: "Keep applying",
    };
  },
  async act(tx, target): Promise<LinkPage | null> {
    if (await cancelOfferPause(tx, target.entityId, target.userId)) {
      return { title: "Nothing is paused", body: "Kairos keeps applying for you as before." };
    }
    const [row] = await tx.select({ state: offerPauseCandidates.state }).from(offerPauseCandidates).where(and(eq(offerPauseCandidates.id, target.entityId), eq(offerPauseCandidates.userId, target.userId)));
    if (row?.state === "applied") {
      throw new LinkRefusal({ title: "Already paused", body: "New applications are paused. You can turn applying back on in Kairos under Billing." });
    }
    return null;
  },
};

export const offerPauseRouter = Router();

offerPauseRouter.get("/", async (req, res) => {
  const body: OfferPauseStatusResponse = await offerPauseStatus(db(), currentUser(req).id);
  res.json(body);
});

offerPauseRouter.post("/resume", async (req, res) => {
  const body: OfferPauseResume = await resumeOfferPause(db(), currentUser(req).id);
  res.json(body);
});

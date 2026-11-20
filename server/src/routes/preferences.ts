import { Router } from "express";
import { emailPreferencesPatchSchema, type EmailPreferencesPatch } from "@auto-career/shared";
import { db } from "../db/client";
import { notFound } from "../lib/errors";
import { validateBody } from "../middleware/validate";
import { currentUser } from "../middleware/require-auth";
import { patchEmailPreferences, readEmailPreferences } from "../services/mail-preferences";

/**
 * GET and PATCH /api/email-preferences (messaging-58): the signed-in person's toggles for the optional mail (digest,
 * weekly outcome report, Autopilot summary, reminders). The send path reads them at send time, so a toggle stops the
 * very next email, not only the next day's. Account mail is not here: it cannot be turned off.
 */
export const emailPreferencesRouter = Router();

emailPreferencesRouter.get("/", async (req, res) => {
  const emailPreferences = await readEmailPreferences(db(), currentUser(req).id);
  if (!emailPreferences) throw notFound("Profile");
  res.json({ emailPreferences });
});

emailPreferencesRouter.patch("/", validateBody(emailPreferencesPatchSchema), async (req, res) => {
  const me = currentUser(req);
  const emailPreferences = await db().transaction(async (tx) => {
    await patchEmailPreferences(tx, me.id, req.body as EmailPreferencesPatch);
    return readEmailPreferences(tx, me.id);
  });
  if (!emailPreferences) throw notFound("Profile");
  res.json({ emailPreferences });
});

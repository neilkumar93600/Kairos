import { Router, type Request } from "express";
import { z } from "zod";
import { extensionClaimSchema, submissionReportSchema, type SubmissionReport } from "@auto-career/shared";
import { db } from "../db/client";
import { HttpError } from "../lib/errors";
import { currentUser } from "../middleware/require-auth";
import { validateBody } from "../middleware/validate";
import { recordExtensionReport } from "../services/settle";
import { claimForExtension, leaseExtensionQueue, releaseForExtension } from "../services/submissions";

/** What the Chrome extension pulls and reports. Mounted at /api/extension; the extension sends a bearer token. */
export const extensionRouter = Router();

/** The claimant's identity (05-api 13): the session behind the bearer token, used only to tell sessions apart. */
const sessionOf = (req: Request): string => {
  if (!req.sessionId) throw new HttpError(401, "unauthorized", "Sign in to continue");
  return req.sessionId;
};

extensionRouter.get("/queue", async (req, res) => {
  res.json({ queue: await leaseExtensionQueue(db(), currentUser(req).id, sessionOf(req)) });
});

/** For the next extension release: the frozen one cannot call them (05-api 13.3). Two tabs: the first claim wins. */
extensionRouter.post("/claim", validateBody(extensionClaimSchema), async (req, res) => {
  const { applicationId } = req.body as z.infer<typeof extensionClaimSchema>;
  res.json(await claimForExtension(db(), currentUser(req).id, sessionOf(req), applicationId));
});

extensionRouter.post("/release", validateBody(extensionClaimSchema), async (req, res) => {
  const { applicationId } = req.body as z.infer<typeof extensionClaimSchema>;
  res.json(await releaseForExtension(db(), currentUser(req).id, sessionOf(req), applicationId));
});

extensionRouter.post("/report", validateBody(submissionReportSchema), async (req, res) => {
  res.json(await recordExtensionReport(db(), currentUser(req).id, sessionOf(req), req.body as SubmissionReport));
});

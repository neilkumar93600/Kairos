import { Router } from "express";
import { contactMessageSchema, type ContactMessage } from "@auto-career/shared";
import { db } from "../db/client";
import { contactMessages } from "../db/schema";
import { sendEmail } from "../lib/mailer";
import { publicFormLimiter } from "../middleware/rate-limit";
import { validateBody } from "../middleware/validate";

/** Public contact form. Mounted at /api/contact, no sign-in needed, 5 per hour per IP. */
export const contactRouter = Router();

contactRouter.post("/", publicFormLimiter, validateBody(contactMessageSchema), async (req, res) => {
  const message = req.body as ContactMessage;
  await db().insert(contactMessages).values(message);
  await sendEmail({
    to: "hello@kairos.app",
    subject: `[contact:${message.topic}] ${message.name}`,
    text: `${message.name} <${message.email}>\n\n${message.message}`,
    tag: "contact",
  });
  res.status(202).json({ ok: true });
});

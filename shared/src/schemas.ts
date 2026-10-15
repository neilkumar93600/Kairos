import { z } from "zod";
import { SENIORITY_LEVELS, WORK_AUTHORIZATIONS } from "./types";

/** Search settings the fit gate enforces before any model call. */
export const preferencesSchema = z.object({
  roles: z.array(z.string().trim().min(2).max(80)).min(1).max(10),
  seniority: z.array(z.enum(SENIORITY_LEVELS)).min(1),
  locations: z.array(z.string().trim().min(2).max(80)).max(20),
  remoteOk: z.boolean(),
  workAuthorization: z.enum(WORK_AUTHORIZATIONS),
  salaryFloorUsd: z.number().int().min(0).max(1_000_000).nullable(),
  excludedCompanies: z.array(z.string().trim().min(1).max(120)).max(200),
  excludedKeywords: z.array(z.string().trim().min(1).max(60)).max(100),
  fitThreshold: z.number().int().min(50).max(95),
  maxApplicationsPerCompanyPer30Days: z.number().int().min(1).max(5),
});
export type Preferences = z.infer<typeof preferencesSchema>;

export const DEFAULT_PREFERENCES: Omit<Preferences, "roles" | "workAuthorization"> = {
  seniority: ["entry"],
  locations: [],
  remoteOk: true,
  salaryFloorUsd: null,
  excludedCompanies: [],
  excludedKeywords: [],
  fitThreshold: 75,
  maxApplicationsPerCompanyPer30Days: 2,
};

/** One answer in an application, editable in the review queue. */
export const applicationAnswerSchema = z.object({
  fieldKey: z.string().min(1).max(200),
  label: z.string().min(1).max(500),
  value: z.string().max(5000),
  source: z.enum(["profile", "saved_answer", "generated", "user_edit"]),
});
export type ApplicationAnswer = z.infer<typeof applicationAnswerSchema>;

/** One tailored resume line; factIds must be non-empty (the truth lock). */
export const resumeLineSchema = z.object({
  id: z.string(),
  section: z.string(),
  text: z.string().min(1).max(400),
  factIds: z.array(z.string()).min(1, "Every resume line must point to at least one profile fact"),
});
export type ResumeLine = z.infer<typeof resumeLineSchema>;

export const updateApplicationSchema = z.object({
  answers: z.array(applicationAnswerSchema).max(200).optional(),
  resumeLines: z.array(resumeLineSchema).max(200).optional(),
  coverLetter: z.string().max(6000).nullable().optional(),
});
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;

export const approveApplicationsSchema = z.object({
  applicationIds: z.array(z.uuid()).min(1).max(50),
  channel: z.enum(["extension", "cloud"]),
});
export type ApproveApplicationsInput = z.infer<typeof approveApplicationsSchema>;

/** What the extension or cloud applier reports back after trying to submit. */
export const submissionReportSchema = z.object({
  applicationId: z.uuid(),
  outcome: z.enum(["submitted", "failed"]),
  failureReason: z.string().max(500).optional(),
  filledFields: z.array(z.object({ fieldKey: z.string(), label: z.string(), value: z.string() })).max(300),
  confirmationText: z.string().max(4000).optional(),
  submittedAt: z.iso.datetime(),
});
export type SubmissionReport = z.infer<typeof submissionReportSchema>;

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email(),
  topic: z.enum(["support", "billing", "partnership", "press", "other"]),
  message: z.string().trim().min(10).max(4000),
});
export type ContactMessage = z.infer<typeof contactMessageSchema>;

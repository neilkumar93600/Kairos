import { z } from "zod";
import { FACT_KINDS, SENIORITY_LEVELS, WORK_AUTHORIZATIONS } from "./types";

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

/* ---- Resume workspace (docs/superpowers/specs/2026-10-23-resume-workspace, section 6) ---- */

export const RESUME_SECTION_KINDS = ["summary", "skills", "experience", "projects", "education", "certifications", "custom"] as const;
export type ResumeSectionKind = (typeof RESUME_SECTION_KINDS)[number];

/** One entry in a section: a role, project or degree with its lines. Summary and skills use one entry. */
export const resumeEntrySchema = z.object({
  id: z.string(),
  heading: z.string().max(200),
  subheading: z.string().max(200).nullable(),
  meta: z.string().max(120).nullable(),
  headingFactId: z.string().nullable(),
  hidden: z.boolean(),
  lines: z.array(resumeLineSchema).max(40),
});
export type ResumeEntry = z.infer<typeof resumeEntrySchema>;

export const resumeSectionSchema = z.object({
  id: z.string(),
  kind: z.enum(RESUME_SECTION_KINDS),
  title: z.string().min(1).max(60),
  hidden: z.boolean(),
  entries: z.array(resumeEntrySchema).max(30),
});
export type ResumeSection = z.infer<typeof resumeSectionSchema>;

export const resumeContactSchema = z.object({
  name: z.string().max(120),
  email: z.string().max(200),
  phone: z.string().max(40),
  location: z.string().max(120),
  links: z.array(z.string().max(300)).max(6),
});
export type ResumeContact = z.infer<typeof resumeContactSchema>;

/** The structured base resume. Every line keeps the truth lock: resumeLineSchema needs at least one fact id. */
export const resumeInputSchema = z.object({
  name: z.string().min(1).max(120),
  density: z.enum(["comfortable", "compact"]),
  contact: resumeContactSchema,
  sections: z.array(resumeSectionSchema).max(12),
});
export type ResumeInput = z.infer<typeof resumeInputSchema>;
export const resumeSchema = resumeInputSchema.extend({ id: z.string(), updatedAt: z.iso.datetime() });
export type Resume = z.infer<typeof resumeSchema>;

/** A proposal from the Resume Writer. needsFact set means there is no text to accept, only a question. */
export const resumeSuggestionSchema = z.object({
  id: z.string(),
  sectionId: z.string(),
  entryId: z.string().nullable(),
  lineId: z.string().nullable(),
  action: z.enum(["rewrite", "add", "remove"]),
  before: z.string().nullable(),
  after: z.string().nullable(),
  why: z.string().max(300),
  factIds: z.array(z.string()),
  needsFact: z.object({ kind: z.enum(FACT_KINDS), question: z.string().max(200) }).nullable(),
});
export type ResumeSuggestion = z.infer<typeof resumeSuggestionSchema>;

export const SUGGESTION_SCOPES = ["resume", "section", "entry", "line", "summary", "skills"] as const;
export const REFINE_OPTIONS = ["shorter", "longer", "result_first", "natural", "use_numbers"] as const;
export const suggestionRequestSchema = z.object({
  scope: z.enum(SUGGESTION_SCOPES),
  sectionId: z.string().optional(),
  entryId: z.string().optional(),
  lineId: z.string().optional(),
  jobId: z.string().optional(),
  refine: z.enum(REFINE_OPTIONS).optional(),
  /** The user's own words. The server saves it as an unconfirmed fact; only facts can be cited. */
  note: z.string().trim().min(3).max(500).optional(),
});
export type SuggestionRequest = z.infer<typeof suggestionRequestSchema>;

/**
 * Deterministic match of a posting against confirmed facts (backend teardown F1, no LLM): Requirements coverage 40,
 * Keyword match 30, Job title 20, Seniority 10. An unverifiable input leaves the denominator, never the numerator.
 */
export const jobFitSchema = z.object({
  jobId: z.string(),
  title: z.string(),
  company: z.string(),
  score: z.number().int().min(0).max(100),
  basis: z.string(),
  band: z.enum(["poor", "fair", "great"]).optional(),
  categories: z
    .array(z.object({ name: z.string(), points: z.number().min(0), max: z.number().min(0), reason: z.string().nullable() }))
    .optional(),
  requirements: z.array(
    z.object({ id: z.string(), text: z.string(), required: z.boolean(), status: z.enum(["covered", "unconfirmed", "missing"]), factIds: z.array(z.string()) }),
  ),
  keywords: z.array(z.object({ term: z.string(), status: z.enum(["in_resume", "has_fact", "no_fact"]), factIds: z.array(z.string()) })),
});
export type JobFit = z.infer<typeof jobFitSchema>;

export const importJobSchema = z.object({ url: z.url().max(500) });
export type ImportJobInput = z.infer<typeof importJobSchema>;

export const draftRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("answer"), fieldKey: z.string().min(1).max(200) }),
  z.object({ kind: z.literal("cover_letter") }),
]);
export type DraftRequest = z.infer<typeof draftRequestSchema>;

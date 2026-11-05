import { z } from "zod";
import {
  FACT_KINDS,
  PAGE_SIZES,
  RESUME_KINDS,
  RESUME_LEVELS,
  SENIORITY_LEVELS,
  SUGGESTION_PRIORITIES,
  SUGGESTION_TAGS,
  TEMPLATE_IDS,
  WORK_AUTHORIZATIONS,
} from "./types";

/** A web address a person typed: http(s) only, so a javascript: or data: URL is never stored (api-auth-security-33). */
export const httpUrl = (max: number) => z.url({ protocol: /^https?$/ }).max(max);

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

/** Where a newsletter form sits on the marketing site (WP-50). */
export const NEWSLETTER_SOURCES = ["popup", "blog-index", "blog-post", "about"] as const;
export type NewsletterSource = (typeof NEWSLETTER_SOURCES)[number];

/**
 * POST /api/newsletter (WP-50). `email` is trimmed and lower-cased before the format check, so one address is one row.
 * `website` is the honeypot: a hidden field people leave empty; the api drops a request that fills it.
 */
export const newsletterSignupSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  source: z.enum(NEWSLETTER_SOURCES),
  website: z.string().max(2048).optional(),
});
export type NewsletterSignup = z.infer<typeof newsletterSignupSchema>;

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

/**
 * A resume link: a bare host ("github.com/ada") or http(s). Any other scheme (javascript:, data:, mailto:) is refused,
 * read as a browser would read it, with spaces and control characters removed. "host:port" has a dot, so it passes.
 */
const resumeLinkSchema = z
  .string()
  .max(300)
  .refine((link) => {
    const scheme = link.replace(/[^\x21-\x7e]/g, "").match(/^([a-z][a-z0-9+.-]*):/i)?.[1];
    return !scheme || scheme.includes(".") || /^https?$/i.test(scheme);
  }, "Links must be web addresses (http or https)");

export const resumeContactSchema = z.object({
  name: z.string().max(120),
  email: z.string().max(200),
  phone: z.string().max(40),
  location: z.string().max(120),
  links: z.array(resumeLinkSchema).max(6),
});
export type ResumeContact = z.infer<typeof resumeContactSchema>;

/** A swatch colour, `#rrggbb`. Used on the name, headings and rules only (PRD 7.2). */
export const accentSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a #rrggbb colour");

/**
 * Optional headline under the name (PRD 8.4). Truth rule 10: it cites the facts it came from, and a year count
 * in it is computed in code from confirmed role dates, never stated by a model.
 */
export const resumeHeadlineSchema = z.object({
  text: z.string().trim().min(1).max(160),
  factIds: z.array(z.string()).min(1, "A headline must point to at least one profile fact"),
});
export type ResumeHeadline = z.infer<typeof resumeHeadlineSchema>;

/**
 * The structured resume as the user edits it. Every line keeps the truth lock: resumeLineSchema needs at least one
 * fact id. The design fields (PRD 7.2, 8.1, 8.4) are optional so the frozen clients and old rows still parse.
 */
export const resumeInputSchema = z.object({
  name: z.string().min(1).max(120),
  density: z.enum(["comfortable", "compact"]),
  contact: resumeContactSchema,
  sections: z.array(resumeSectionSchema).max(12),
  templateId: z.enum(TEMPLATE_IDS).optional(),
  accent: accentSchema.nullable().optional(),
  pageSize: z.enum(PAGE_SIZES).optional(),
  /** Experience level the AI review calibrates to, stored per resume (PRD 8.1). */
  level: z.enum(RESUME_LEVELS).optional(),
  headline: resumeHeadlineSchema.nullable().optional(),
});
export type ResumeInput = z.infer<typeof resumeInputSchema>;

/** Server-managed fields (PRD 11, schema changes). All optional here: the legacy /resume route does not send them. */
export const resumeMetaShape = {
  kind: z.enum(RESUME_KINDS),
  /** The library name ("Frontend"). The document's own `name` stays the person's name. */
  libraryName: z.string().min(1).max(80),
  isDefault: z.boolean(),
  targetRoles: z.array(z.string().trim().min(1).max(80)).max(10),
  /** Null once the base is deleted (PRD 6.1). */
  baseResumeId: z.string().nullable(),
  /** Name of the base a copy started from, for "Started from {name}". */
  baseName: z.string().nullable(),
  /** True when the base changed after this copy was made (PRD 6.3). */
  baseChanged: z.boolean(),
  jobId: z.string().nullable(),
  applicationId: z.string().nullable(),
  /** True once the application is sent: the sent snapshot is frozen (PRD 6.1). */
  readOnly: z.boolean(),
};
export const resumeSchema = resumeInputSchema
  .extend({ id: z.string(), updatedAt: z.iso.datetime() })
  .extend(z.object(resumeMetaShape).partial().shape);
export type Resume = z.infer<typeof resumeSchema>;
/** What every /resumes route returns: all server-managed and design fields present. */
export const resumeDetailSchema = resumeSchema.required();
export type ResumeDetail = z.infer<typeof resumeDetailSchema>;

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
  /** PRD 8.3. Optional so suggestions from before R3 still parse. */
  tag: z.enum(SUGGESTION_TAGS).optional(),
  priority: z.enum(SUGGESTION_PRIORITIES).optional(),
  /** Values computed in code from confirmed facts (rule 10), for example years of experience in a headline. */
  derived: z.array(z.object({ label: z.string().max(60), value: z.union([z.number(), z.string()]), factIds: z.array(z.string()).min(1) })).optional(),
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

export const importJobSchema = z.object({ url: httpUrl(500) });
export type ImportJobInput = z.infer<typeof importJobSchema>;

export const draftRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("answer"), fieldKey: z.string().min(1).max(200) }),
  z.object({ kind: z.literal("cover_letter") }),
]);
export type DraftRequest = z.infer<typeof draftRequestSchema>;

// In-app notifications (WP-44, 05-api 12.1). Rows carry ids and codes only; the title is joined when read.
export const NOTIFICATION_KINDS = ["autopilot_sent", "autopilot_paused", "resend_available", "offer_pause_notice", "reply_important", "forwarding_code"] as const;
export const notificationSchema = z.object({
  id: z.uuid(),
  kind: z.enum(NOTIFICATION_KINDS),
  createdAt: z.string(),
  readAt: z.string().nullable(),
  title: z.string().max(200),
  applicationId: z.uuid().nullable(),
  detail: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});
export type Notification = z.infer<typeof notificationSchema>;
export const notificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().max(200).optional(),
  unread: z.enum(["true"]).optional(),
});
export const notificationsResponseSchema = z.object({
  notifications: z.array(notificationSchema),
  unread: z.number().int().min(0),
  nextCursor: z.string().optional(),
});
export const notificationsReadSchema = z.union([z.strictObject({ ids: z.array(z.uuid()).min(1).max(100) }), z.strictObject({ all: z.literal(true) })]);
export type NotificationsRead = z.infer<typeof notificationsReadSchema>;

// Reply forwarding setup (WP-24, 05-api 12.x "Forwarding"). Informational: no product gate depends on the state.
export const FORWARDING_STATES = ["not_started", "awaiting_verification", "verified_pending_first_mail", "active", "stale"] as const;
export type ForwardingState = (typeof FORWARDING_STATES)[number];
export const forwardingStatusSchema = z.object({
  state: z.enum(FORWARDING_STATES),
  address: z.string(),
  lastMailAt: z.string().nullable(),
  /** The Gmail code and confirmation link Kairos received for the user, for 3 days, or null. */
  verification: z
    .object({ provider: z.literal("gmail"), code: z.string().nullable(), confirmUrl: z.url().nullable(), expiresAt: z.string() })
    .nullable(),
});
export type ForwardingStatus = z.infer<typeof forwardingStatusSchema>;
/** "I have set it up": the only signal Gmail or Outlook gives. */
export const forwardingConfirmSchema = z.strictObject({ provider: z.enum(["gmail", "outlook", "other"]) });
export type ForwardingConfirm = z.infer<typeof forwardingConfirmSchema>;

/* ---- Email preferences and saved searches (WP-35, 05-api 10.8 and 12.1) ---- */

/** The optional mail kinds a person can turn on or off; true means "send me this". Account mail (codes, receipts, resend links, billing notices) is not here: it cannot be turned off. */
export const emailPreferencesSchema = z.strictObject({
  digest: z.boolean(),
  outcomeReport: z.boolean(),
  autopilotSummary: z.boolean(),
  reminders: z.boolean(),
});
export type EmailPreferences = z.infer<typeof emailPreferencesSchema>;
export const emailPreferencesPatchSchema = emailPreferencesSchema.partial().refine((o) => Object.keys(o).length > 0, "Send at least one preference");
export type EmailPreferencesPatch = z.infer<typeof emailPreferencesPatchSchema>;
export const emailPreferencesResponseSchema = z.object({ emailPreferences: emailPreferencesSchema });

/** Filters over the user's own matches; they add no scoring. Mirrors saved_search_filters_valid() in the database. */
export const savedSearchFiltersSchema = z.strictObject({
  minScore: z.number().int().min(0).max(100).optional(),
  roles: z.array(z.string().trim().min(2).max(80)).max(10).optional(),
  companies: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  remoteOnly: z.boolean().optional(),
});
export type SavedSearchFilters = z.infer<typeof savedSearchFiltersSchema>;
export const SAVED_SEARCH_FREQUENCY_VALUES = ["off", "daily", "weekly"] as const;
export const savedSearchInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(60),
  filters: savedSearchFiltersSchema.default({}),
  frequency: z.enum(SAVED_SEARCH_FREQUENCY_VALUES).default("daily"),
});
export type SavedSearchInput = z.infer<typeof savedSearchInputSchema>;
export const savedSearchPatchSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(60),
    filters: savedSearchFiltersSchema,
    frequency: z.enum(SAVED_SEARCH_FREQUENCY_VALUES),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, "Send at least one field");
export type SavedSearchPatch = z.infer<typeof savedSearchPatchSchema>;
export const savedSearchSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  filters: savedSearchFiltersSchema,
  frequency: z.enum(SAVED_SEARCH_FREQUENCY_VALUES),
  /** When the next digest is due; null while frequency is off. */
  nextDigestAt: z.string().nullable(),
  createdAt: z.string(),
});
export type SavedSearch = z.infer<typeof savedSearchSchema>;

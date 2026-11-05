/**
 * Resume suite contract: PRD docs/superpowers/specs/2026-10-29-resume-suite section 11 (R1 versions and import,
 * R2 templates and export, R3 review and headline, R4 tracker). Additive: nothing in schemas.ts is renamed.
 * The web builds against web/scripts/qa/mock-api.mjs first (decision D7); the real routes replay the same cases.
 *
 * Errors keep today's shape `{ error: { code, message, details } }`. A spent daily AI allowance is
 * 429 `rate_limited` with `details.reason = "daily_allowance"` (decision: 402 stays "no credits").
 */
import { z } from "zod";
import {
  APPLICATION_EVENT_KINDS,
  CLOSED_REASONS,
  EXPORT_FORMATS,
  FACT_KINDS,
  IMPORT_SOURCE_KINDS,
  INSIGHTS_MIN_SAMPLE,
  INSIGHT_RANGES,
  INTERVIEW_KINDS,
  PARSE_STATUSES,
  RESUME_KINDS,
  RESUME_LEVELS,
  REVISION_REASONS,
  TEMPLATE_IDS,
  TRACKER_STAGES,
} from "./types";
import { AI_FEATURES } from "./plans";
import {
  SUGGESTION_SCOPES,
  accentSchema,
  httpUrl,
  jobFitSchema,
  resumeDetailSchema,
  resumeInputSchema,
  resumeSuggestionSchema,
  suggestionRequestSchema,
} from "./schemas";

const id = z.string().min(1).max(100);
const at = z.iso.datetime();

/* ---- errors ---- */

export const apiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }) });
export type ApiError = z.infer<typeof apiErrorSchema>;

export const dailyAllowanceDetailsSchema = z.object({
  reason: z.literal("daily_allowance"),
  feature: z.enum(AI_FEATURES),
  limit: z.number().int().min(0),
  used: z.number().int().min(0),
  /** Next 00:00 UTC. */
  resetsAt: at,
});
export const dailyAllowanceErrorSchema = z.object({
  error: z.object({ code: z.literal("rate_limited"), message: z.string(), details: dailyAllowanceDetailsSchema }),
});
export type DailyAllowanceError = z.infer<typeof dailyAllowanceErrorSchema>;

/* ---- facts (shared with the profile routes) ---- */

export const factSchema = z.object({
  id,
  kind: z.enum(FACT_KINDS),
  text: z.string().min(1).max(600),
  sourceSpan: z.string().nullable(),
  confirmed: z.boolean(),
  /** Imports are 'import' and unconfirmed until the user confirms them (truth rule 7). */
  assertedBy: z.enum(["user", "import", "model"]).optional(),
});
export type Fact = z.infer<typeof factSchema>;

/** 422 `truth_lock` details, as on today's PUT /resume: the ids of the lines that cite no confirmed fact ("headline" for the headline). */
export const truthLockDetailsSchema = z.object({ lineIds: z.array(z.string()).min(1) });

/* ---- R1: resumes, revisions ---- */

export const resumeSummarySchema = z.object({
  id,
  /** Library name, for example "Frontend". */
  name: z.string().min(1).max(80),
  kind: z.enum(RESUME_KINDS),
  isDefault: z.boolean(),
  targetRoles: z.array(z.string()).max(10),
  resumeProfileId: id,
  /** Only the library of a user with several profiles shows it (PRD 6.1). */
  resumeProfileName: z.string().nullable(),
  baseResumeId: z.string().nullable(),
  baseName: z.string().nullable(),
  jobId: z.string().nullable(),
  jobTitle: z.string().nullable(),
  company: z.string().nullable(),
  stage: z.enum(TRACKER_STAGES).nullable(),
  /** Deterministic match score of the job, when this is a tailored copy. */
  matchScore: z.number().int().min(0).max(100).nullable(),
  /** Resume check score of the document (deterministic). */
  checkScore: z.number().int().min(0).max(100).nullable(),
  templateId: z.enum(TEMPLATE_IDS),
  readOnly: z.boolean(),
  updatedAt: at,
});
export type ResumeSummary = z.infer<typeof resumeSummarySchema>;

export const listResumesQuerySchema = z.object({ kind: z.enum(RESUME_KINDS).optional() });
export const listResumesResponseSchema = z.object({ resumes: z.array(resumeSummarySchema) });

const resumeNameSchema = z.string().trim().min(1).max(80);
const targetRolesSchema = z.array(z.string().trim().min(1).max(80)).max(10);

export const createResumeRequestSchema = z.discriminatedUnion("from", [
  z.object({
    from: z.literal("facts"),
    name: resumeNameSchema,
    targetRoles: targetRolesSchema.optional(),
    /** Defaults to the profile the user is working in (D8). */
    resumeProfileId: id.optional(),
    /** Build in the section order of this import (PRD 6.4 step 3). */
    importId: id.optional(),
  }),
  z.object({ from: z.literal("duplicate"), sourceId: id, name: resumeNameSchema, targetRoles: targetRolesSchema.optional() }),
]);
export type CreateResumeRequest = z.infer<typeof createResumeRequestSchema>;

export const resumeResponseSchema = z.object({ resume: resumeDetailSchema });
/** PUT /resumes/:id takes today's ResumeInput, now with the optional design fields. */
export const updateResumeRequestSchema = resumeInputSchema;
/** Addition to the PRD table: rename and target roles (library card menu, PRD 6.6). */
export const patchResumeRequestSchema = z
  .object({ name: resumeNameSchema.optional(), targetRoles: targetRolesSchema.optional() })
  .refine((v) => v.name !== undefined || v.targetRoles !== undefined, "Send a name or target roles");

export const revisionSummarySchema = z.object({
  id,
  name: z.string().nullable(),
  reason: z.enum(REVISION_REASONS),
  createdAt: at,
});
export type RevisionSummary = z.infer<typeof revisionSummarySchema>;
export const listRevisionsResponseSchema = z.object({ revisions: z.array(revisionSummarySchema) });
export const createRevisionRequestSchema = z.object({ name: z.string().trim().min(1).max(80) });
export const revisionResponseSchema = z.object({ revision: revisionSummarySchema });
/** Addition to the PRD table: the document of one revision, for Compare (PRD 6.6). */
export const revisionDetailResponseSchema = z.object({ revision: revisionSummarySchema.extend({ document: resumeInputSchema }) });

/* ---- R2: templates and export ---- */

export const templateSchema = z.object({
  id: z.enum(TEMPLATE_IDS),
  name: z.string().min(1).max(40),
  /** A template with atsSafe false could only be downloaded, never uploaded by the applier (PRD 7.1). */
  atsSafe: z.boolean(),
  /** Up to 8 swatches, each at least 4.5:1 on white; empty when the template has no accent. */
  accents: z.array(accentSchema).max(8),
});
export type Template = z.infer<typeof templateSchema>;
export const listTemplatesResponseSchema = z.object({ templates: z.array(templateSchema) });

export const exportQuerySchema = z.object({ format: z.enum(EXPORT_FORMATS) });

/* ---- R3: tailoring, suggestions ---- */

export const tailorRequestSchema = z.object({ jobId: id, baseResumeId: id.optional() });
export const tailorResponseSchema = z.object({
  resume: resumeDetailSchema,
  suggestions: z.array(resumeSuggestionSchema),
  fit: jobFitSchema,
});
/** 409 `exists` details: there is at most one active tailored copy per job and user. */
export const tailorExistsDetailsSchema = z.object({ resumeId: id });

export const RESUME_SUGGESTION_SCOPES = [...SUGGESTION_SCOPES, "headline"] as const;
export const resumeSuggestionRequestSchema = suggestionRequestSchema.extend({
  scope: z.enum(RESUME_SUGGESTION_SCOPES),
  resumeId: id,
  /** Defaults to the resume's stored level. */
  level: z.enum(RESUME_LEVELS).optional(),
});
export type ResumeSuggestionRequest = z.infer<typeof resumeSuggestionRequestSchema>;
export const suggestResumesResponseSchema = z.object({ suggestions: z.array(resumeSuggestionSchema), factCreated: factSchema.nullable() });

/* ---- R1: imports ---- */

/** JSON body of POST /profile/imports; a file goes as multipart field `file` instead. */
export const createImportRequestSchema = z.object({
  text: z.string().min(200).max(60_000),
  name: z.string().trim().min(1).max(120).optional(),
  resumeProfileId: id.optional(),
});
export const createImportResponseSchema = z.object({ importId: id, parseStatus: z.enum(PARSE_STATUSES) });

export const importFactSchema = factSchema.extend({
  /** Facts group by employment on the confirm step (PRD 6.4). Null for skills, education and so on. */
  employmentId: z.string().nullable(),
});
export const importDetailSchema = z.object({
  importId: id,
  sourceKind: z.enum(IMPORT_SOURCE_KINDS),
  fileName: z.string().nullable(),
  parseStatus: z.enum(PARSE_STATUSES),
  /** Progress in words ("Reading your resume", "Finding your roles") while parsing. */
  progressText: z.string().nullable(),
  /** `no_text_layer` for a scanned PDF (422 on create, or the failure code of a parse that failed). */
  failureCode: z.string().nullable(),
  employments: z.array(z.object({ id, title: z.string(), company: z.string(), dates: z.string() })),
  facts: z.array(importFactSchema),
  /** Fact ids already in the bank ("Already in your profile"): shown, not duplicated. */
  duplicates: z.array(z.string()),
  /** Contact data found in the file, offered for Profile and never stored as facts. */
  contact: z.object({ name: z.string().nullable(), email: z.string().nullable(), phone: z.string().nullable(), location: z.string().nullable(), links: z.array(z.string()) }).nullable(),
});
export type ImportDetail = z.infer<typeof importDetailSchema>;
export const confirmFactsRequestSchema = z.object({ ids: z.array(id).min(1).max(200) });
export const confirmFactsResponseSchema = z.object({ facts: z.array(factSchema) });

/* ---- R4: tracker ---- */

export const trackerItemSchema = z.object({
  id,
  stage: z.enum(TRACKER_STAGES),
  stageSetBy: z.enum(["system", "user"]),
  closedReason: z.enum(CLOSED_REASONS).nullable(),
  /** Opaque fractional-index key; order within a column is the user's, ascending. */
  position: z.string().max(64),
  title: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  location: z.string().nullable(),
  url: z.string().nullable(),
  jobId: z.string().nullable(),
  applicationId: z.string().nullable(),
  /** Status of the linked application, to explain a locked drag (PRD 9.1). */
  applicationStatus: z.string().nullable(),
  /** Tracking-only: no Kairos application, cannot be sent by Kairos. */
  trackingOnly: z.boolean(),
  matchScore: z.number().int().min(0).max(100).nullable(),
  /** The resume version chip. */
  resumeId: z.string().nullable(),
  resumeName: z.string().nullable(),
  /** Card badge "Send failed, credit refunded". */
  sendFailedRefunded: z.boolean(),
  lastActivityAt: at,
  nextInterviewAt: at.nullable(),
  salaryText: z.string().max(200).nullable(),
  archivedAt: at.nullable(),
  createdAt: at,
});
export type TrackerItem = z.infer<typeof trackerItemSchema>;

/** Detail adds private text (rule 12) and the saved posting, kept when the posting is taken down. */
export const trackerItemDetailSchema = trackerItemSchema.extend({
  notes: z.string().max(10_000),
  descriptionText: z.string().nullable(),
  contactIds: z.array(id),
});
export type TrackerItemDetail = z.infer<typeof trackerItemDetailSchema>;

export const listTrackerQuerySchema = z.object({
  view: z.enum(["board", "table"]).optional(),
  stage: z.enum(TRACKER_STAGES).optional(),
  q: z.string().max(100).optional(),
  archived: z.enum(["true", "false"]).optional(),
});
export const listTrackerResponseSchema = z.object({ items: z.array(trackerItemSchema) });

export const createTrackerItemRequestSchema = z.union([
  z.object({ matchId: id }),
  z.object({ url: httpUrl(500) }),
  z.object({
    manual: z.object({
      title: z.string().trim().min(1).max(200),
      company: z.string().trim().min(1).max(200),
      location: z.string().trim().max(200).optional(),
      url: httpUrl(500).optional(),
    }),
  }),
]);
export type CreateTrackerItemRequest = z.infer<typeof createTrackerItemRequestSchema>;
export const trackerItemResponseSchema = z.object({ item: trackerItemDetailSchema });

export const patchTrackerItemRequestSchema = z
  .object({
    stage: z.enum(TRACKER_STAGES).optional(),
    closedReason: z.enum(CLOSED_REASONS).optional(),
    position: z.string().max(64).optional(),
    notes: z.string().max(10_000).optional(),
    salaryText: z.string().max(200).nullable().optional(),
    archived: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Send at least one field")
  .refine((v) => v.stage !== "closed" || v.closedReason !== undefined, { message: "Closing needs a reason", path: ["closedReason"] });
export type PatchTrackerItemRequest = z.infer<typeof patchTrackerItemRequestSchema>;

/** 409 `stage_owned_by_pipeline` details.reason (PRD 9.1); the message holds the user-facing words. */
export const STAGE_LOCK_REASONS = ["approve_in_review_queue", "withdraw_first", "pipeline_stage"] as const;
export const stageLockDetailsSchema = z.object({ reason: z.enum(STAGE_LOCK_REASONS) });

/**
 * One timeline row. `payload` by kind: saved/drafted {}, resume_linked {resumeId, resumeName}, approved {channel},
 * submitted {applicationId}, failed {reason}, refunded {}, withdrawn {}, reply_routed {emailId, replyKind, sender},
 * stage_changed {from, to, closedReason}, interview_added {interviewId}, note_added {} (never the note text).
 */
export const applicationEventSchema = z.object({
  id,
  trackerItemId: id,
  kind: z.enum(APPLICATION_EVENT_KINDS),
  source: z.enum(["system", "user"]),
  payload: z.record(z.string(), z.unknown()),
  at,
});
export type ApplicationEvent = z.infer<typeof applicationEventSchema>;
export const listEventsResponseSchema = z.object({ events: z.array(applicationEventSchema) });

/** Replies in a funnel row are any reply other than a confirmation. */
const rateOrNull = z.number().min(0).max(1).nullable();
export const insightGroupSchema = z
  .object({ sent: z.number().int().min(0), replies: z.number().int().min(0), interviews: z.number().int().min(0), replyRate: rateOrNull })
  .refine((g) => g.sent >= INSIGHTS_MIN_SAMPLE || g.replyRate === null, "Below the minimum sample only counts are shown");
export const insightsSchema = z
  .object({
    range: z.enum(INSIGHT_RANGES),
    sent: z.number().int().min(0),
    replies: z.number().int().min(0),
    interviews: z.number().int().min(0),
    offers: z.number().int().min(0),
    replyRate: rateOrNull,
    interviewRate: rateOrNull,
    medianDaysToFirstReply: z.number().min(0).nullable(),
    /** True when sent is below the minimum sample: show counts, never percentages. */
    lowSample: z.boolean(),
    funnel: z.array(z.object({ stage: z.enum(TRACKER_STAGES), count: z.number().int().min(0) })),
    byResume: z.array(z.object({ resumeId: id, name: z.string(), sent: z.number().int().min(0), replies: z.number().int().min(0), replyRate: rateOrNull })),
  })
  .superRefine((v, ctx) => {
    if (v.lowSample !== v.sent < INSIGHTS_MIN_SAMPLE) ctx.addIssue({ code: "custom", message: "lowSample must equal sent < 5", path: ["lowSample"] });
    if (v.lowSample && (v.replyRate !== null || v.interviewRate !== null)) ctx.addIssue({ code: "custom", message: "Below the minimum sample only counts are shown", path: ["replyRate"] });
    for (const [i, g] of v.byResume.entries()) {
      if (g.sent < INSIGHTS_MIN_SAMPLE && g.replyRate !== null) ctx.addIssue({ code: "custom", message: "Below the minimum sample only counts are shown", path: ["byResume", i, "replyRate"] });
    }
  });
export type Insights = z.infer<typeof insightsSchema>;
export const insightsQuerySchema = z.object({ range: z.enum(INSIGHT_RANGES).optional() });
export const insightsResponseSchema = z.object({ insights: insightsSchema });

/* ---- R4: contacts and interviews ---- */

export const contactInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  title: z.string().trim().max(120).optional(),
  company: z.string().trim().max(200).optional(),
  email: z.email().max(200).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  linkedinUrl: httpUrl(300).nullable().optional(),
  /** Private (rule 12): no agent reads it, nothing sends it. */
  notes: z.string().max(5000).optional(),
  jobIds: z.array(id).max(100).optional(),
});
export type ContactInput = z.infer<typeof contactInputSchema>;
export const patchContactRequestSchema = contactInputSchema.partial();
export const contactSchema = z.object({
  id,
  name: z.string(),
  title: z.string(),
  company: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  notes: z.string(),
  /** Tracker item ids this contact is linked to. */
  jobIds: z.array(id),
  createdAt: at,
  updatedAt: at,
});
export type Contact = z.infer<typeof contactSchema>;
export const listContactsQuerySchema = z.object({ q: z.string().max(100).optional(), jobId: id.optional() });
export const listContactsResponseSchema = z.object({ contacts: z.array(contactSchema) });
export const contactResponseSchema = z.object({ contact: contactSchema });

/** Kairos never guesses a date: start and time zone are required. */
export const interviewInputSchema = z.object({
  startsAt: at,
  /** IANA name, for example America/New_York. */
  timeZone: z.string().min(1).max(64),
  durationMinutes: z.number().int().min(5).max(24 * 60),
  kind: z.enum(INTERVIEW_KINDS),
  /** A place or a meeting link. */
  location: z.string().max(500).nullable().optional(),
  contactIds: z.array(id).max(20).optional(),
  notes: z.string().max(5000).optional(),
  outcome: z.string().max(500).nullable().optional(),
});
export type InterviewInput = z.infer<typeof interviewInputSchema>;
export const patchInterviewRequestSchema = interviewInputSchema.partial();
export const interviewSchema = z.object({
  id,
  trackerItemId: id,
  startsAt: at,
  timeZone: z.string(),
  durationMinutes: z.number().int(),
  kind: z.enum(INTERVIEW_KINDS),
  location: z.string().nullable(),
  contactIds: z.array(id),
  notes: z.string(),
  outcome: z.string().nullable(),
  createdAt: at,
});
export type Interview = z.infer<typeof interviewSchema>;
export const interviewWithJobSchema = interviewSchema.extend({ jobTitle: z.string(), company: z.string() });
export const listInterviewsQuerySchema = z.object({ from: at.optional() });
export const listInterviewsResponseSchema = z.object({ interviews: z.array(interviewWithJobSchema) });
export const interviewResponseSchema = z.object({ interview: interviewSchema });

/* ---- the route table ---- */

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export interface SuiteRoute {
  id: string;
  method: Method;
  /** Express-style path under /api. Register /tracker/insights before /tracker/:id. */
  path: string;
  query?: z.ZodType;
  request?: z.ZodType;
  /** The 2xx JSON body; "empty" for 204, "file" for a download (PDF, DOCX, text, calendar). */
  response: z.ZodType | "empty" | "file";
  status: number;
  /** Error responses the web must handle, beyond 401 and 400 validation. */
  errors: { status: number; code: string }[];
}

const E = (status: number, code: string) => ({ status, code });
const NOT_FOUND = E(404, "not_found");
// Metered by the per-feature daily allowance: 429 rate_limited, reason daily_allowance (not 402).
const ALLOWANCE = E(429, "rate_limited");

export const RESUME_SUITE_ROUTES: readonly SuiteRoute[] = [
  { id: "listResumes", method: "GET", path: "/resumes", query: listResumesQuerySchema, response: listResumesResponseSchema, status: 200, errors: [] },
  { id: "createResume", method: "POST", path: "/resumes", request: createResumeRequestSchema, response: resumeResponseSchema, status: 201, errors: [E(409, "limit_reached"), NOT_FOUND, E(422, "truth_lock")] },
  { id: "getResume", method: "GET", path: "/resumes/:id", response: resumeResponseSchema, status: 200, errors: [NOT_FOUND] },
  { id: "putResume", method: "PUT", path: "/resumes/:id", request: updateResumeRequestSchema, response: resumeResponseSchema, status: 200, errors: [NOT_FOUND, E(422, "truth_lock"), E(409, "read_only")] },
  { id: "patchResume", method: "PATCH", path: "/resumes/:id", request: patchResumeRequestSchema, response: resumeResponseSchema, status: 200, errors: [NOT_FOUND, E(409, "read_only")] },
  { id: "deleteResume", method: "DELETE", path: "/resumes/:id", response: "empty", status: 204, errors: [NOT_FOUND, E(409, "is_default"), E(409, "last_base")] },
  { id: "setDefaultResume", method: "POST", path: "/resumes/:id/default", response: resumeResponseSchema, status: 200, errors: [NOT_FOUND, E(409, "not_base")] },
  { id: "listRevisions", method: "GET", path: "/resumes/:id/revisions", response: listRevisionsResponseSchema, status: 200, errors: [NOT_FOUND] },
  { id: "getRevision", method: "GET", path: "/resumes/:id/revisions/:revId", response: revisionDetailResponseSchema, status: 200, errors: [NOT_FOUND] },
  { id: "createRevision", method: "POST", path: "/resumes/:id/revisions", request: createRevisionRequestSchema, response: revisionResponseSchema, status: 201, errors: [NOT_FOUND] },
  { id: "restoreRevision", method: "POST", path: "/resumes/:id/revisions/:revId/restore", response: resumeResponseSchema, status: 200, errors: [NOT_FOUND, E(409, "read_only")] },
  { id: "exportResume", method: "GET", path: "/resumes/:id/export", query: exportQuerySchema, response: "file", status: 200, errors: [NOT_FOUND, E(503, "service_unavailable")] },
  { id: "tailorResume", method: "POST", path: "/resumes/tailor", request: tailorRequestSchema, response: tailorResponseSchema, status: 200, errors: [NOT_FOUND, E(409, "exists"), ALLOWANCE] },
  { id: "suggestResume", method: "POST", path: "/resumes/suggestions", request: resumeSuggestionRequestSchema, response: suggestResumesResponseSchema, status: 200, errors: [NOT_FOUND, ALLOWANCE, E(422, "invalid_scope"), E(409, "read_only"), E(503, "ai_unavailable")] },
  { id: "listTemplates", method: "GET", path: "/templates", response: listTemplatesResponseSchema, status: 200, errors: [] },
  { id: "createImport", method: "POST", path: "/profile/imports", request: createImportRequestSchema, response: createImportResponseSchema, status: 202, errors: [E(413, "payload_too_large"), E(415, "unsupported_type"), E(422, "no_text_layer"), E(429, "rate_limited")] },
  { id: "getImport", method: "GET", path: "/profile/imports/:id", response: importDetailSchema, status: 200, errors: [NOT_FOUND] },
  { id: "confirmFacts", method: "POST", path: "/profile/facts/confirm", request: confirmFactsRequestSchema, response: confirmFactsResponseSchema, status: 200, errors: [NOT_FOUND] },
  { id: "listTracker", method: "GET", path: "/tracker", query: listTrackerQuerySchema, response: listTrackerResponseSchema, status: 200, errors: [] },
  { id: "createTrackerItem", method: "POST", path: "/tracker", request: createTrackerItemRequestSchema, response: trackerItemResponseSchema, status: 201, errors: [NOT_FOUND, E(422, "unsupported_board")] },
  { id: "trackerInsights", method: "GET", path: "/tracker/insights", query: insightsQuerySchema, response: insightsResponseSchema, status: 200, errors: [E(403, "forbidden")] },
  { id: "getTrackerItem", method: "GET", path: "/tracker/:id", response: trackerItemResponseSchema, status: 200, errors: [NOT_FOUND] },
  { id: "patchTrackerItem", method: "PATCH", path: "/tracker/:id", request: patchTrackerItemRequestSchema, response: trackerItemResponseSchema, status: 200, errors: [NOT_FOUND, E(409, "stage_owned_by_pipeline")] },
  { id: "listTrackerEvents", method: "GET", path: "/tracker/:id/events", response: listEventsResponseSchema, status: 200, errors: [NOT_FOUND] },
  { id: "listContacts", method: "GET", path: "/contacts", query: listContactsQuerySchema, response: listContactsResponseSchema, status: 200, errors: [] },
  { id: "createContact", method: "POST", path: "/contacts", request: contactInputSchema, response: contactResponseSchema, status: 201, errors: [NOT_FOUND] },
  { id: "getContact", method: "GET", path: "/contacts/:id", response: contactResponseSchema, status: 200, errors: [NOT_FOUND] },
  { id: "patchContact", method: "PATCH", path: "/contacts/:id", request: patchContactRequestSchema, response: contactResponseSchema, status: 200, errors: [NOT_FOUND] },
  { id: "deleteContact", method: "DELETE", path: "/contacts/:id", response: "empty", status: 204, errors: [NOT_FOUND] },
  { id: "listInterviews", method: "GET", path: "/interviews", query: listInterviewsQuerySchema, response: listInterviewsResponseSchema, status: 200, errors: [] },
  { id: "createInterview", method: "POST", path: "/tracker/:id/interviews", request: interviewInputSchema, response: interviewResponseSchema, status: 201, errors: [NOT_FOUND] },
  { id: "patchInterview", method: "PATCH", path: "/tracker/:id/interviews/:iid", request: patchInterviewRequestSchema, response: interviewResponseSchema, status: 200, errors: [NOT_FOUND] },
  { id: "deleteInterview", method: "DELETE", path: "/tracker/:id/interviews/:iid", response: "empty", status: 204, errors: [NOT_FOUND] },
  { id: "interviewIcs", method: "GET", path: "/tracker/:id/interviews/:iid.ics", response: "file", status: 200, errors: [NOT_FOUND] },
];

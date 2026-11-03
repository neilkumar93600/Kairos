/**
 * Enums shared by the database, the API, the web app and the extension.
 * Kept as `as const` arrays so each side can build zod enums, pg enums and UI labels from one list.
 */

export const ATS_PROVIDERS = ["greenhouse", "lever", "ashby"] as const;
export type AtsProvider = (typeof ATS_PROVIDERS)[number];

/** Sign-in methods; GET /api/auth-providers returns the configured subset as `{ providers }`. */
export const AUTH_PROVIDERS = ["email", "google"] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export const MATCH_STATUSES = ["new", "queued", "skipped", "expired"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

/** draft -> approved -> submitting -> submitted | failed; failed submissions are refunded. */
export const APPLICATION_STATUSES = [
  "draft",
  "approved",
  "submitting",
  "submitted",
  "failed",
  "refunded",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Who sends the application: the Chrome extension in the user's browser, or the cloud applier. */
export const SUBMIT_CHANNELS = ["extension", "cloud"] as const;
export type SubmitChannel = (typeof SUBMIT_CHANNELS)[number];

export const SENIORITY_LEVELS = ["intern", "entry", "mid", "senior", "lead"] as const;
export type Seniority = (typeof SENIORITY_LEVELS)[number];

export const WORK_AUTHORIZATIONS = ["citizen_or_pr", "needs_sponsorship_now", "needs_sponsorship_later", "opt_stem_opt"] as const;
export type WorkAuthorization = (typeof WORK_AUTHORIZATIONS)[number];

export const FACT_KINDS = ["role", "project", "skill", "metric", "education", "certification"] as const;
export type FactKind = (typeof FACT_KINDS)[number];

export const EMAIL_KINDS = ["confirmation", "rejection", "interview", "offer", "assessment", "other"] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

export const CREDIT_REASONS = ["plan_grant", "free_grant", "submission", "refund_failed_submit", "admin_adjustment", "expiry"] as const;
export type CreditReason = (typeof CREDIT_REASONS)[number];

/* ---- Resume suite (docs/superpowers/specs/2026-10-29-resume-suite, sections 6 to 9 and 11) ---- */

/** A base resume is edited directly; a tailored one is a copy made for one job. */
export const RESUME_KINDS = ["base", "tailored"] as const;
export type ResumeKind = (typeof RESUME_KINDS)[number];

/** Experience level of the AI review (PRD 8.1): early career = intern and entry. */
export const RESUME_LEVELS = ["early_career", "mid", "senior", "lead"] as const;
export type ResumeLevel = (typeof RESUME_LEVELS)[number];

export const PAGE_SIZES = ["letter", "a4"] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

/** The six launch templates, all single-column and ATS-safe (PRD 7.1). */
export const TEMPLATE_IDS = ["kairos-single-v1", "modern", "serif", "compact", "executive", "minimal"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const SUGGESTION_TAGS = ["lead_with_result", "be_concise", "stay_relevant", "show_scope", "use_your_numbers", "fix_spelling", "remove_filler"] as const;
export type SuggestionTag = (typeof SUGGESTION_TAGS)[number];

export const SUGGESTION_PRIORITIES = ["high", "medium", "low"] as const;
export type SuggestionPriority = (typeof SUGGESTION_PRIORITIES)[number];

export const REVISION_REASONS = ["edit", "named", "before_ai", "before_tailor", "restore"] as const;
export type RevisionReason = (typeof REVISION_REASONS)[number];

export const EXPORT_FORMATS = ["pdf", "docx", "txt"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const IMPORT_SOURCE_KINDS = ["pdf", "docx", "linkedin_pdf", "text"] as const;
export type ImportSourceKind = (typeof IMPORT_SOURCE_KINDS)[number];

/** resume_profiles.parse_status of worker spec 11. */
export const PARSE_STATUSES = ["pending", "parsing", "parsed", "failed"] as const;
export type ParseStatus = (typeof PARSE_STATUSES)[number];

export const TRACKER_STAGES = ["saved", "drafting", "applied", "interviewing", "offer", "closed"] as const;
export type TrackerStage = (typeof TRACKER_STAGES)[number];

export const CLOSED_REASONS = ["rejected", "withdrawn", "not_pursuing", "posting_closed"] as const;
export type ClosedReason = (typeof CLOSED_REASONS)[number];

export const INTERVIEW_KINDS = ["phone", "video", "onsite", "assessment", "other"] as const;
export type InterviewKind = (typeof INTERVIEW_KINDS)[number];

/** Append-only timeline of a tracker item (PRD 9.3). Notes are never in a payload (rule 12). */
export const APPLICATION_EVENT_KINDS = [
  "saved",
  "drafted",
  "resume_linked",
  "approved",
  "submitted",
  "failed",
  "refunded",
  "withdrawn",
  "reply_routed",
  "stage_changed",
  "interview_added",
  "note_added",
] as const;
export type ApplicationEventKind = (typeof APPLICATION_EVENT_KINDS)[number];

export const INSIGHT_RANGES = ["30d", "90d", "all"] as const;
export type InsightRange = (typeof INSIGHT_RANGES)[number];

/** PRD 6.5: base resumes per resume profile, every plan. */
export const MAX_BASE_RESUMES_PER_PROFILE = 10;
/** PRD 9.6: a group below this many sent applications shows counts, never percentages. */
export const INSIGHTS_MIN_SAMPLE = 5;
/** PRD 6.1 [call]: newest unnamed revisions kept per resume; named ones are never pruned. */
export const UNNAMED_REVISIONS_KEPT = 50;

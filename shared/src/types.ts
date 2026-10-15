/**
 * Enums shared by the database, the API, the web app and the extension.
 * Kept as `as const` arrays so each side can build zod enums, pg enums and UI labels from one list.
 */

export const ATS_PROVIDERS = ["greenhouse", "lever", "ashby"] as const;
export type AtsProvider = (typeof ATS_PROVIDERS)[number];

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

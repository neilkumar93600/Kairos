/**
 * The error codes the api may emit and the statuses each may carry (05-api 4.4). Append one line per new code, in
 * alphabetical order, in the same commit as the first HttpError that uses it: test/error-catalog.test.ts scans src/ and
 * fails on a code or a code/status pair that is not listed. A code listed twice-over (two statuses) lists both.
 */
//
// details shapes the web may read (05-api 4.5): rate_limited { reason: "user_limit" | "ip_limit" | "daily_allowance" |
// "service_budget", bucket?: limiter class (anon, user_api, billing, contact, newsletter, newsletter_one_click, link, webhook_ip, ai_burst), retryAfterSec?,
// resetsAt? }; reauth_required { maxAgeSec }; service_unavailable { retryAfterSec?, reason? } (reason "resumes_user_uq": a
// second resume before the contract migration of WP-17 runs; it carries no Retry-After, a retry cannot succeed).
// WP-17's resume library and imports: exists { resumeId }, limit_reached { limit }, truth_lock { lineIds, reasons? },
// unsupported_type and unreadable { reason } (the file gate's reason code), payload_too_large { limitBytes }.
// approvals_frozen, cloud_paused, extension_only and unknown_flag are WP-27's (ops flags); listed here because this file is the catalog.
// resume_refused { reason: not_dead | past_browser_step | not_approved | no_application | no_refusal_check } is WP-22's (POST /api/admin/outbox/:id/resume).
export const ERROR_CATALOG: Record<string, readonly number[]> = {
  ai_refused: [422],
  ai_unavailable: [503],
  acknowledgement_required: [409],
  already_claimed: [409],
  already_subscribed: [409],
  approvals_frozen: [503],
  bad_request: [400],
  bad_signature: [400],
  billing_unavailable: [503],
  checkout_failed: [502],
  cloud_paused: [503],
  conflict: [409],
  email_unverified: [403],
  exists: [409],
  extension_only: [409],
  fact_cited: [409],
  forbidden: [403],
  internal: [500],
  invalid_body: [400, 422],
  invalid_json: [400],
  invalid_param: [400],
  invalid_scope: [422],
  is_default: [409],
  last_base: [409],
  limit_reached: [409],
  no_text_layer: [422],
  not_approvable: [409],
  not_base: [409],
  not_found: [404],
  origin_not_allowed: [403],
  payload_too_large: [413],
  payment_required: [402],
  posting_not_found: [404],
  price_unavailable: [400],
  profile_only: [422],
  rate_limited: [429],
  read_only: [409],
  reauth_required: [403],
  resume_refused: [409],
  route_not_found: [404],
  service_unavailable: [503],
  storage_unavailable: [503],
  timeout: [503],
  truth_lock: [422],
  unauthorized: [401],
  unknown_flag: [422],
  unreadable: [422],
  unsupported_board: [422],
  unsupported_type: [415],
};

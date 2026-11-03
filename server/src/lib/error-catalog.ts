/**
 * The error codes the api may emit and the statuses each may carry (05-api 4.4). Append one line per new code, in
 * alphabetical order, in the same commit as the first HttpError that uses it: test/error-catalog.test.ts scans src/ and
 * fails on a code or a code/status pair that is not listed. A code listed twice-over (two statuses) lists both.
 */
export const ERROR_CATALOG: Record<string, readonly number[]> = {
  ai_refused: [422],
  ai_unavailable: [503],
  already_subscribed: [409],
  bad_request: [400],
  bad_signature: [400],
  billing_unavailable: [503],
  checkout_failed: [502],
  conflict: [409],
  email_unverified: [403],
  fact_cited: [409],
  forbidden: [403],
  internal: [500],
  invalid_body: [422],
  invalid_json: [400],
  invalid_param: [400],
  invalid_scope: [422],
  not_found: [404],
  origin_not_allowed: [403],
  payload_too_large: [413],
  payment_required: [402],
  posting_not_found: [404],
  price_unavailable: [400],
  profile_only: [422],
  rate_limited: [429],
  reauth_required: [403],
  route_not_found: [404],
  storage_unavailable: [503],
  timeout: [503],
  truth_lock: [422],
  unauthorized: [401],
  unsupported_board: [422],
};

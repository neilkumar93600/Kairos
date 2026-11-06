-- WP-19: the applier's two database needs for a snapshot PDF. Custom migration, written by hand. No table changes.
--   1. record_attempt_result accepts render_failed: a snapshot that could not be rendered closes the attempt as "nothing was
--      sent" (02-database 7.3.1). The body is 0027's with that one code added. CREATE OR REPLACE keeps the grants.
--   2. applier_needs_render says whether this attempt's snapshot holds a document, for the delivery holding the attempt.
--      It lets a legacy row skip the render queue. A boolean about the row, no content: it reads nothing that
--      get_applier_payload does not already serve this holder. kairos_applier's EXECUTE is in ops/provision-roles.sql.
-- Expand-only: the old applier never reports the new code and never calls the new function.

CREATE OR REPLACE FUNCTION record_attempt_result(p_attempt_id uuid, p_state text, p_failure_code text, p_evidence jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_evidence) k WHERE k NOT IN ('filledFieldKeys', 'confirmationText', 'detail')) THEN
    RAISE EXCEPTION 'evidence holds a key a run does not write' USING ERRCODE = '22023';
  END IF;
  IF p_state = 'submitted' THEN
    IF p_failure_code IS NOT NULL THEN RAISE EXCEPTION 'a submitted result carries no failure code' USING ERRCODE = '22023'; END IF;
    UPDATE submission_attempts
       SET state = 'submitted', phase = 'reported', evidence = p_evidence, settled_at = NULL
     WHERE id = p_attempt_id AND channel = 'cloud'
       AND (state = 'open' OR (state IN ('failed','needs_check') AND failure_code IN ('unconfirmed','timeout','no_report')));
  ELSIF p_state = 'failed' THEN
    IF p_failure_code IS NULL OR p_failure_code NOT IN
       ('challenge','posting_closed','required_missing','applier_error','unconfirmed','timeout','plan_lapsed','cloud_unavailable_for_ats','render_failed') THEN
      RAISE EXCEPTION 'failure code % is not one the applier may report', p_failure_code USING ERRCODE = '22023';
    END IF;
    UPDATE submission_attempts                          -- a no-op when the sweep already closed the attempt
       SET state = 'failed', phase = 'reported', evidence = p_evidence,
           failure_code = CASE WHEN submit_seen_at IS NOT NULL AND p_failure_code <> 'unconfirmed' THEN 'timeout' ELSE p_failure_code END
     WHERE id = p_attempt_id AND state = 'open' AND channel = 'cloud';
  ELSE
    RAISE EXCEPTION 'bad state %', p_state USING ERRCODE = '22023';
  END IF;
END $$;--> statement-breakpoint

CREATE FUNCTION applier_needs_render(p_attempt_id uuid, p_worker text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM submission_attempts t JOIN applications a ON a.id = t.application_id
     WHERE t.id = p_attempt_id AND t.state = 'open' AND t.channel = 'cloud'
       AND t.browser_launched_at IS NOT NULL AND t.worker_identity = left(p_worker, 100)
       AND jsonb_typeof(a.resume_snapshot->'document') = 'object');
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION applier_needs_render(uuid, text) FROM PUBLIC;

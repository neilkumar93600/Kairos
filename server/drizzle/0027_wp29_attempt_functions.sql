-- wp29_attempt_functions (WP-29; database-11, 69; applications-57, 60; _db/applications.md 5.7). Hand-written (drizzle-kit
-- generate --custom); no table or column changes, so the previous release runs unchanged on this file.
--
-- The applier's only way to the data: SECURITY DEFINER functions owned by the migrator. They replace the interim table
-- grants of kairos_applier (WP-04): the applier can no longer read an application that has no pending cloud send, write a
-- status after the claim, or touch the ledger. Grants are in ops/provision-roles.sql; EXECUTE is revoked from PUBLIC here,
-- because development and test databases have no roles and no default privileges.
--
-- Differences from the text of 5.7, each listed in reviews/WP-29.md:
--   1. applier_job replaces applier_payload_v for the read before the claim: no content, and only a row with a pending
--      send. get_applier_payload gives the content only to an open attempt, so answers are readable after a claim only.
--   2. Rows approved by the previous release have attempt_no 0, which the attempts table refuses (attempt_no >= 1): the
--      claim moves them to 1, so a job of either release claims the same attempt.
--   3. record_attempt_result accepts `unconfirmed` as well as `timeout`: the run already knows a fill was interrupted.
--   4. A `submitted` result reaching an attempt the sweep already closed as ambiguous moves it forward (late confirmation)
--      and clears settled_at, so settlement records it: a submission the employer received is always recorded (RL-1).
--      5.7 drops it, which leaves the user told "unconfirmed" about a send we know reached the employer.
--   5. A failed result after the apply POST was seen is stored as `timeout` (08-submission-settlement 13, item 4).
--   6. mark_attempt_phase returns whether the attempt is still open, and the run stops on false (see the function).
--   7. mark_browser_launched binds the attempt to the delivery that won it, and get_applier_payload serves only that holder:
--      a re-delivery that loses the mark never reads the answers, and one that wins it (the first died before launching)
--      rebinds, so a replacement replica still runs. worker_identity therefore names the holder, not the first claimer.
--   8. record_attempt_result takes only the three evidence keys a run writes: an allowlist under the table's denylist.
--
-- search_path = public on these functions is safe only because provision-roles.sql revokes CREATE on public from every
-- runtime role: no role that can call them can plant an object they would resolve.

-- The read before the claim. No answers, lines or letter; nothing at all once the row is not a pending cloud send.
CREATE FUNCTION applier_job(p_application_id uuid)
RETURNS TABLE (status text, attempt_no int, user_id text, apply_url text, closed_at timestamptz, approved_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.status::text, a.attempt_no, a.user_id, j.apply_url, j.closed_at, a.approved_at
    FROM applications a JOIN jobs j ON j.id = a.job_id
   WHERE a.id = p_application_id AND a.channel = 'cloud' AND a.status IN ('approved', 'submitting');
$$;--> statement-breakpoint

-- approved -> submitting and the attempt row, in one transaction. A replay of a committed claim returns the same attempt,
-- so a job that died before its browser launched can still run; mark_browser_launched is what stops a second click.
-- Null: nothing to send (withdrawn, re-approved under a newer number, or never this attempt).
-- The application id is the capability: nothing binds a claim to a job or a token, so a compromised applier that knows the
-- id of a pending cloud send can claim that send and read it. There is no token path; ids are not listable by this role.
CREATE FUNCTION claim_cloud_attempt(p_application_id uuid, p_attempt_no int, p_worker text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user text; v_by text; v_ats ats_provider; v_attempt uuid; v_no int := greatest(p_attempt_no, 1);
BEGIN
  SELECT id INTO v_attempt FROM submission_attempts
   WHERE application_id = p_application_id AND attempt_no = v_no AND channel = 'cloud';
  IF v_attempt IS NOT NULL THEN RETURN v_attempt; END IF;

  SELECT a.user_id, a.approved_by, c.ats INTO v_user, v_by, v_ats
    FROM applications a JOIN jobs j ON j.id = a.job_id JOIN companies c ON c.id = j.company_id
   WHERE a.id = p_application_id AND a.status = 'approved' AND a.channel = 'cloud' AND greatest(a.attempt_no, 1) = v_no
     FOR UPDATE OF a;
  IF NOT FOUND THEN
    -- Another worker may have claimed it while this call waited for the row lock.
    SELECT id INTO v_attempt FROM submission_attempts
     WHERE application_id = p_application_id AND attempt_no = v_no AND channel = 'cloud';
    RETURN v_attempt;
  END IF;

  INSERT INTO submission_attempts (application_id, user_id, attempt_no, channel, ats, approved_by, worker_identity, heartbeat_at)
  VALUES (p_application_id, v_user, v_no, 'cloud', v_ats, v_by, left(p_worker, 100), now())
  RETURNING id INTO v_attempt;

  UPDATE applications SET status = 'submitting', current_attempt_id = v_attempt, attempt_no = v_no WHERE id = p_application_id;
  RETURN v_attempt;
END $$;--> statement-breakpoint

-- What the run fills in: only for the delivery that holds the launch mark, and only while the attempt is open.
CREATE FUNCTION get_applier_payload(p_attempt_id uuid, p_worker text)
RETURNS TABLE (answers jsonb, resume_lines jsonb, cover_letter text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.answers, a.resume_lines, a.cover_letter
    FROM submission_attempts s JOIN applications a ON a.id = s.application_id
   WHERE s.id = p_attempt_id AND s.state = 'open' AND s.channel = 'cloud'
     AND s.browser_launched_at IS NOT NULL AND s.worker_identity = left(p_worker, 100);
$$;--> statement-breakpoint

-- The one delivery that sets this owns the attempt: it alone reads the payload, opens a browser and records a result. False
-- when another delivery already holds it, or the attempt is closed: this one writes nothing and never clicks.
CREATE FUNCTION mark_browser_launched(p_attempt_id uuid, p_worker text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (
    UPDATE submission_attempts SET browser_launched_at = now(), heartbeat_at = now(), worker_identity = left(p_worker, 100)
     WHERE id = p_attempt_id AND state = 'open' AND channel = 'cloud' AND browser_launched_at IS NULL
    RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM u);
$$;--> statement-breakpoint

-- Moves the phase forward and renews the heartbeat; a repeat of the same phase is the heartbeat. 'reported' is
-- record_attempt_result's. submit_seen_at is set by submission_attempts_guard. False once the attempt is closed: a run the
-- sweep gave up on (closed "nothing was sent", so resendable) must not go on to click, so it stops on this answer.
CREATE FUNCTION mark_attempt_phase(p_attempt_id uuid, p_phase text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (
    UPDATE submission_attempts SET phase = p_phase, heartbeat_at = now()
     WHERE id = p_attempt_id AND state = 'open' AND channel = 'cloud'
       AND p_phase IN ('claimed','navigating','filling','submit_seen')
       AND array_position(ARRAY['claimed','navigating','filling','submit_seen','reported'], p_phase)
        >= array_position(ARRAY['claimed','navigating','filling','submit_seen','reported'], phase)
    RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM u);
$$;--> statement-breakpoint

-- The run's result, on the attempt row only: settlement (worker) moves the application and writes the ledger. The evidence
-- check (submission_attempts_evidence_ck) refuses oversized or value-carrying evidence inside the UPDATE.
CREATE FUNCTION record_attempt_result(p_attempt_id uuid, p_state text, p_failure_code text, p_evidence jsonb)
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
       ('challenge','posting_closed','required_missing','applier_error','unconfirmed','timeout','plan_lapsed','cloud_unavailable_for_ats') THEN
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

REVOKE ALL ON FUNCTION applier_job(uuid), claim_cloud_attempt(uuid, int, text), get_applier_payload(uuid, text), mark_browser_launched(uuid, text),
                       mark_attempt_phase(uuid, text), record_attempt_result(uuid, text, text, jsonb) FROM PUBLIC;

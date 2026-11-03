-- lifecycle_backfill (WP-42; database-51, 61, 73; 02-database 14.4 B-5, B-8, B-10; _db/applications.md 8.3). A drizzle-kit
-- custom file, written by hand. Every data statement selects only rows that still need it, so a rerun changes nothing
-- (schema-lifecycle.int.test.ts runs this file twice). SQL in a migration is allowed while each table is below 100,000
-- rows (14.4): owner-actions/WP-42.md counts them first. B-6 (job hints) is TypeScript: refreshJobHints.

-- B-5: companies. A company never polled and inactive was pasted by a user (WP-00 stores imports inactive); one that
-- 404'd is board_not_found; any other inactive company was switched off by the owner. Reasons first: an update holds
-- every check of 0009, companies_active_reason_ck included. Then the hosts, from (ats, api_region) through
-- companies_fill_hosts, which a no-op update of api_host fires.
UPDATE companies SET discovered_by = 'import', inactive_reason = 'import_pending'
 WHERE NOT active AND inactive_reason IS NULL AND last_polled_at IS NULL;--> statement-breakpoint
UPDATE companies SET inactive_reason = CASE WHEN last_poll_error = 'board_not_found' THEN 'board_not_found' ELSE 'owner' END
 WHERE NOT active AND inactive_reason IS NULL;--> statement-breakpoint
UPDATE companies SET api_host = api_host WHERE api_host IS NULL OR apply_host IS NULL;--> statement-breakpoint

-- jobs: every job closed so far was closed by the poller. Then a job stored before WP-04 may carry the payload's URL
-- (an employer's own careers page): it is rebuilt to the hosted form services/ats builds today, the only URL the applier
-- accepts, and only then does jobs_apply_url_host_ck (moved here from 0009 by hand) hold every new write.
UPDATE jobs SET closed_by = 'poll' WHERE closed_at IS NOT NULL AND closed_by IS NULL;--> statement-breakpoint
UPDATE jobs j SET apply_url = CASE c.ats
         WHEN 'greenhouse' THEN 'https://job-boards.greenhouse.io/embed/job_app?for=' || c.board_token || '&token=' || j.external_id
         WHEN 'lever'      THEN 'https://jobs.lever.co/' || c.board_token || '/' || j.external_id || '/apply'
         WHEN 'ashby'      THEN 'https://jobs.ashbyhq.com/' || c.board_token || '/' || j.external_id || '/application' END
  FROM companies c
 WHERE c.id = j.company_id
   AND j.apply_url !~ '^https://(boards\.greenhouse\.io|job-boards\.greenhouse\.io|jobs\.lever\.co|jobs\.eu\.lever\.co|jobs\.ashbyhq\.com)/';--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_apply_url_host_ck" CHECK (apply_url ~ '^https://(boards\.greenhouse\.io|job-boards\.greenhouse\.io|jobs\.lever\.co|jobs\.eu\.lever\.co|jobs\.ashbyhq\.com)/') NOT VALID;--> statement-breakpoint

-- B-10, the part today's writers agree with: a match is an import when its posting was pasted, or when it failed the
-- gate (the scorer stores passed rows only; the import route stores a failed one as skipped, also for a posting that was
-- already polled, so no such row is a pipeline row to delete under C-1). Gate-failing imports to below_bar and unscored
-- 'new' imports to expired wait for WP-23, which changes the import route to write them that way (the frozen web still
-- queues a skipped import).
UPDATE matches m SET source = 'manual_url', selection = 'import'
  FROM jobs j WHERE j.id = m.job_id AND m.source = 'pipeline' AND (j.source = 'manual_url' OR NOT m.passed_filters);--> statement-breakpoint

-- B-8 statement 2: every row ever approved was approved by its user, once.
UPDATE applications SET approved_by = 'user' WHERE approved_at IS NOT NULL AND approved_by IS NULL;--> statement-breakpoint
UPDATE applications SET attempt_no = 1 WHERE approved_at IS NOT NULL AND attempt_no = 0;--> statement-breakpoint

-- B-8 statement 3: failure codes. The cloud applier stores the FAILURE_MESSAGES sentences of services/submissions.ts, so
-- those map exactly; free text from the extension falls back to the spec's patterns.
UPDATE applications SET failure_code = CASE
         WHEN failure_reason LIKE '%asked for a human check%'                             THEN 'challenge'
         WHEN failure_reason LIKE '%posting has closed%'                                  THEN 'posting_closed'
         WHEN failure_reason LIKE '%required question had no answer%'                     THEN 'required_missing'
         WHEN failure_reason LIKE '%stopped before the submit step%'                      THEN 'applier_error'
         WHEN failure_reason LIKE '%no longer includes the cloud applier%'                THEN 'plan_lapsed'
         WHEN failure_reason LIKE '%could not confirm whether the employer received%'     THEN 'unconfirmed'
         WHEN failure_reason ~* 'captcha|challenge|robot|verify you are human|bot'        THEN 'challenge'
         WHEN failure_reason ~* 'closed|no longer (open|accepting|available)|not found|404' THEN 'posting_closed'
         WHEN channel = 'cloud' THEN 'applier_error'
         ELSE 'extension_reported' END
 WHERE status = 'failed' AND failure_code IS NULL;--> statement-breakpoint

-- B-8 statement 4: draft state. Unverified content is stale (the P3 cut-over rule); only rows still at the default.
UPDATE applications SET draft_state = CASE
         WHEN status IN ('draft','failed') AND jsonb_array_length(resume_lines) > 0 THEN 'stale'
         WHEN status = 'draft'                                                       THEN 'pending'
         WHEN jsonb_array_length(resume_lines) > 0                                   THEN 'ready'
         ELSE 'needs_facts' END
 WHERE draft_state = 'pending';--> statement-breakpoint

-- B-8 statement 5: the terminal clock for the scrub and failed expiry.
UPDATE applications SET terminal_at = COALESCE(submitted_at, updated_at)
 WHERE status IN ('submitted','failed','withdrawn') AND terminal_at IS NULL;--> statement-breakpoint

-- B-8 statement 6: one attempt per application that ever left draft on an attempt. An ambiguous failure stays
-- needs_check (submission_attempts_settled_ck); a legacy claim is open in submit_seen with an epoch heartbeat, so
-- WP-29's lease sweeper settles it as unconfirmed. The company comes through the job (applications.company_id is not
-- added yet).
INSERT INTO submission_attempts (application_id, user_id, attempt_no, channel, ats, approved_by, phase, state,
                                 failure_code, started_at, heartbeat_at, finished_at, settled_at)
SELECT a.id, a.user_id, 1, a.channel, c.ats, 'user',
       CASE WHEN a.status = 'submitting' THEN 'submit_seen' ELSE 'reported' END,
       CASE WHEN a.status = 'submitted' THEN 'submitted'
            WHEN a.status = 'failed' AND a.failure_code IN ('unconfirmed','timeout','no_report') THEN 'needs_check'
            WHEN a.status = 'failed' THEN 'failed'
            ELSE 'open' END,
       CASE WHEN a.status = 'failed' THEN a.failure_code END,
       COALESCE(a.approved_at, a.created_at),
       CASE WHEN a.status = 'submitting' AND a.channel = 'cloud' THEN to_timestamp(0) END,
       CASE WHEN a.status IN ('submitted','failed') THEN COALESCE(a.submitted_at, a.updated_at) END,
       CASE WHEN a.status = 'submitted' OR (a.status = 'failed' AND a.failure_code NOT IN ('unconfirmed','timeout','no_report'))
            THEN COALESCE(a.submitted_at, a.updated_at) END
  FROM applications a JOIN jobs j ON j.id = a.job_id JOIN companies c ON c.id = j.company_id
 WHERE a.status IN ('submitting','submitted','failed') AND a.channel IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM submission_attempts s WHERE s.application_id = a.id AND s.attempt_no = 1 AND s.channel = a.channel);--> statement-breakpoint
UPDATE applications a SET current_attempt_id = s.id
  FROM submission_attempts s WHERE s.application_id = a.id AND s.attempt_no = 1 AND a.current_attempt_id IS NULL;--> statement-breakpoint

-- B-8 statement 7: submitted rows start at 'applied', then move forward by the replies already linked (rejection wins).
-- Only from 'applied', so a rerun never asks applications_guard_stage to move a stage backward.
UPDATE applications SET stage = 'applied' WHERE status = 'submitted' AND stage IS NULL;--> statement-breakpoint
WITH r AS (
  SELECT application_id,
         max(CASE kind WHEN 'confirmation' THEN 2 WHEN 'assessment' THEN 3 WHEN 'interview' THEN 4 WHEN 'offer' THEN 5 END) AS rank,
         bool_or(kind = 'rejection') AS rejected
    FROM inbound_emails WHERE application_id IS NOT NULL GROUP BY application_id)
UPDATE applications a
   SET stage = CASE WHEN r.rejected THEN 'rejected'
                    ELSE (ARRAY['applied','in_review','assessment','interviewing','offer'])[r.rank] END
  FROM r
 WHERE a.id = r.application_id AND a.status = 'submitted' AND a.stage = 'applied' AND (r.rejected OR r.rank > 1);--> statement-breakpoint

-- tracker_items (02-database 7.7, PRD 9.1): every application has one. The board stage follows the application.
INSERT INTO tracker_items (user_id, job_id, application_id, stage, closed_reason, stage_set_by, created_at, updated_at)
SELECT a.user_id, a.job_id, a.id,
       CASE WHEN a.status = 'withdrawn' THEN 'closed'
            WHEN a.status = 'submitted' THEN CASE a.stage WHEN 'rejected' THEN 'closed' WHEN 'offer' THEN 'offer'
                                                          WHEN 'interviewing' THEN 'interviewing' WHEN 'assessment' THEN 'interviewing'
                                                          ELSE 'applied' END
            ELSE 'drafting' END,
       CASE WHEN a.status = 'withdrawn' THEN 'withdrawn' WHEN a.status = 'submitted' AND a.stage = 'rejected' THEN 'rejected' END,
       'system', a.created_at, a.updated_at
  FROM applications a
ON CONFLICT (user_id, job_id) WHERE job_id IS NOT NULL DO NOTHING;--> statement-breakpoint

-- B-8 statement 8: one event per fact the skeleton recorded, keyed by tracker item (dedupe keys make a rerun a no-op).
INSERT INTO application_events (tracker_item_id, application_id, user_id, kind, actor, payload, dedupe_key, at)
SELECT t.id, e.id, e.user_id, e.kind, e.actor, e.payload, e.dedupe_key, e.at
  FROM (SELECT id, user_id, 'drafted' AS kind, 'system' AS actor, '{"backfilled":true}'::jsonb AS payload, 'drafted' AS dedupe_key, created_at AS at
          FROM applications
        UNION ALL
        SELECT id, user_id, 'approved', 'user', jsonb_build_object('backfilled', true, 'attemptNo', 1, 'channel', channel::text), 'approved:1', approved_at
          FROM applications WHERE approved_at IS NOT NULL
        UNION ALL
        SELECT id, user_id, 'sent', 'system', jsonb_build_object('backfilled', true, 'attemptNo', 1, 'channel', channel::text), 'sent', submitted_at
          FROM applications WHERE status = 'submitted' AND submitted_at IS NOT NULL
        UNION ALL
        SELECT id, user_id, 'failed', 'system', jsonb_build_object('backfilled', true, 'attemptNo', 1, 'code', failure_code), 'failed:1', updated_at
          FROM applications WHERE status = 'failed'
        UNION ALL
        SELECT id, user_id, 'withdrawn', 'user', '{"backfilled":true}'::jsonb, 'withdrawn', updated_at
          FROM applications WHERE status = 'withdrawn') e
  JOIN tracker_items t ON t.application_id = e.id
ON CONFLICT (tracker_item_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;--> statement-breakpoint

-- Hand-moved from 0009: the five checks over legacy data, added only now so a legacy row that breaks one cannot abort
-- the updates above. NOT VALID: they hold every new write; owner-actions/WP-42.md step 4 validates them.
ALTER TABLE "companies" ADD CONSTRAINT "companies_name_ck" CHECK (char_length(name) BETWEEN 1 AND 200) NOT VALID;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_board_token_ck" CHECK (board_token ~ '^[A-Za-z0-9_.-]{1,100}$') NOT VALID;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_score_ck" CHECK (score IS NULL OR score BETWEEN 0 AND 100) NOT VALID;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_json_ck" CHECK (jsonb_typeof(resume_lines) = 'array' AND jsonb_array_length(resume_lines) <= 200
        AND jsonb_typeof(answers) = 'array' AND jsonb_array_length(answers) <= 200
        AND (questions IS NULL OR (jsonb_typeof(questions) = 'array' AND jsonb_array_length(questions) <= 200))
        AND (verification IS NULL OR (jsonb_typeof(verification) = 'object'
             AND verification->>'state' IN ('none','pending','passed','failed') AND pg_column_size(verification) <= 16384))
        AND (resume_line_entries IS NULL OR (jsonb_typeof(resume_line_entries) = 'object' AND pg_column_size(resume_line_entries) <= 16384))
        AND (receipt IS NULL OR jsonb_typeof(receipt) = 'object')
        AND (receipt_summary IS NULL OR jsonb_typeof(receipt_summary) = 'object')) NOT VALID;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_text_ck" CHECK ((facts_snapshot_hash IS NULL OR facts_snapshot_hash ~ '^[0-9a-f]{64}$')
        AND (resume_file_key IS NULL OR char_length(resume_file_key) <= 200)
        AND (failure_reason IS NULL OR char_length(failure_reason) <= 500)
        AND (lease_session_id IS NULL OR char_length(lease_session_id) <= 100)) NOT VALID;

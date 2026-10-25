-- platform_02_llm_ledger (spec 02-database.md 7.6, _db/platform.md 7.2-7.3, additive columns of
-- 03-agent-runtime.md 8.2): the llm_calls ledger (weekly range partitions, 90 days), the daily
-- roll-up, per-user day counters and the F11 per-feature allowance counters.
-- Role grants (REVOKE/GRANT to kairos_worker, kairos_api) ship with ops/provision-roles.sql,
-- which runs before this file in release order; this migration only creates objects.
-- Applied by hand through `drizzle-kit generate --custom`; never edit after first apply (INV-21).

CREATE SEQUENCE llm_calls_id_seq AS bigint;
--> statement-breakpoint
CREATE TABLE llm_calls (
  id                  bigint        NOT NULL DEFAULT nextval('llm_calls_id_seq'),
  created_at          timestamptz   NOT NULL DEFAULT now(),
  agent_id            text          NOT NULL,
  prompt_version      smallint      NOT NULL,
  prompt_sha256       bytea         NOT NULL,
  model               text          NOT NULL,
  workspace           text          NOT NULL,
  is_batch            boolean       NOT NULL DEFAULT false,
  plan                plan_id,
  user_hash           bytea,                                -- first 16 bytes of HMAC-SHA256(USER_HASH_KEY, user id); scrubbed on erasure
  application_id      uuid,                                 -- logical reference
  job_id              uuid,
  input_refs          jsonb,                                -- ids only
  input_hash          bytea         NOT NULL,
  input_tokens        integer       NOT NULL DEFAULT 0,
  cache_read_tokens   integer       NOT NULL DEFAULT 0,
  cache_write_tokens  integer       NOT NULL DEFAULT 0,
  output_tokens       integer       NOT NULL DEFAULT 0,
  cost_usd            numeric(12,8) NOT NULL DEFAULT 0,
  latency_ms          integer,
  stop_reason         text,
  status              text          NOT NULL,
  attempts            smallint      NOT NULL DEFAULT 1,
  tiered_up           boolean       NOT NULL DEFAULT false,
  error_code          text,
  provider_request_id text,                                 -- Anthropic request-id header, for support tickets
  call_kind           text          NOT NULL DEFAULT 'primary'
    CHECK (call_kind IN ('primary','retry','repair','tier_up','truth_repair','shadow','canary','audit','nightly')),
  budget_class        text          NOT NULL DEFAULT 'pipeline'
    CHECK (budget_class IN ('pipeline','interactive','ops','eval')),
  trace_id            text,                                 -- OpenTelemetry trace id
  batch_id            text,                                 -- Message Batches id when is_batch
  CONSTRAINT llm_calls_pk            PRIMARY KEY (id, created_at),
  CONSTRAINT llm_calls_agent_ck      CHECK (agent_id ~ '^[a-z][a-z0-9-]{2,40}$'),
  CONSTRAINT llm_calls_model_ck      CHECK (model ~ '^claude-(haiku|sonnet)-5-5(-[0-9]{8})?$'),   -- Opus 5.5 and Fable 5.1 never in production
  CONSTRAINT llm_calls_workspace_ck  CHECK (workspace IN ('batch','interactive')),
  CONSTRAINT llm_calls_status_ck     CHECK (status IN ('ok','schema_invalid','max_tokens','blocked','error','budget_stopped')),
  CONSTRAINT llm_calls_error_code_ck CHECK ((status = 'ok') = (error_code IS NULL) AND (error_code IS NULL OR error_code ~ '^[a-z0-9_]{1,64}$')),
  CONSTRAINT llm_calls_hash_len_ck   CHECK (octet_length(prompt_sha256) = 32 AND octet_length(input_hash) = 32
                                           AND (user_hash IS NULL OR octet_length(user_hash) = 16)),
  CONSTRAINT llm_calls_counts_ck     CHECK (input_tokens >= 0 AND cache_read_tokens >= 0 AND cache_write_tokens >= 0
                                           AND output_tokens >= 0 AND cost_usd >= 0 AND attempts >= 1),
  CONSTRAINT llm_calls_refs_ck       CHECK (input_refs IS NULL OR (jsonb_typeof(input_refs) = 'object' AND octet_length(input_refs::text) <= 2048)),
  CONSTRAINT llm_calls_batch_ck      CHECK (NOT is_batch OR workspace = 'batch'),
  CONSTRAINT llm_calls_tier_ck       CHECK (NOT tiered_up OR model LIKE 'claude-sonnet-%')
) PARTITION BY RANGE (created_at);
--> statement-breakpoint
ALTER SEQUENCE llm_calls_id_seq OWNED BY llm_calls.id;
--> statement-breakpoint
CREATE TABLE llm_calls_default PARTITION OF llm_calls DEFAULT;                 -- alert if it ever holds a row
--> statement-breakpoint
CREATE INDEX llm_calls_created_brin ON llm_calls USING brin (created_at) WITH (pages_per_range = 32);
--> statement-breakpoint
CREATE INDEX llm_calls_failures_idx ON llm_calls (agent_id, created_at) WHERE status <> 'ok';
--> statement-breakpoint
-- 7.6.2 llm_cost_daily: daily roll-up, recomputed from llm_calls; kept forever.
CREATE TABLE llm_cost_daily (
  day                  date          NOT NULL,
  agent_id             text          NOT NULL,
  workspace            text          NOT NULL,
  plan                 text          NOT NULL,              -- plan_id value or 'none' for system calls
  model                text          NOT NULL,
  is_batch             boolean       NOT NULL,
  calls                integer       NOT NULL,
  calls_ok             integer       NOT NULL DEFAULT 0,
  calls_schema_invalid integer       NOT NULL DEFAULT 0,
  calls_max_tokens     integer       NOT NULL DEFAULT 0,
  calls_blocked        integer       NOT NULL DEFAULT 0,
  calls_error          integer       NOT NULL DEFAULT 0,
  calls_budget_stopped integer       NOT NULL DEFAULT 0,
  calls_tiered_up      integer       NOT NULL DEFAULT 0,
  input_tokens         bigint        NOT NULL DEFAULT 0,
  cache_read_tokens    bigint        NOT NULL DEFAULT 0,
  cache_write_tokens   bigint        NOT NULL DEFAULT 0,
  output_tokens        bigint        NOT NULL DEFAULT 0,
  cost_usd             numeric(14,8) NOT NULL,
  latency_ms_sum       bigint        NOT NULL DEFAULT 0,
  updated_at           timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (day, agent_id, workspace, plan, model, is_batch),
  CONSTRAINT llm_cost_daily_plan_ck      CHECK (plan IN ('free','starter','pro','max','none')),
  CONSTRAINT llm_cost_daily_workspace_ck CHECK (workspace IN ('batch','interactive')),
  CONSTRAINT llm_cost_daily_calls_ck     CHECK (calls = calls_ok + calls_schema_invalid + calls_max_tokens + calls_blocked + calls_error + calls_budget_stopped),
  CONSTRAINT llm_cost_daily_bounds_ck    CHECK (calls_tiered_up <= calls AND cost_usd >= 0)
);
--> statement-breakpoint
-- 7.6.3 user_daily_usage: per-user UTC-day counters for caps, spend and the demand budget; 90 days.
CREATE TABLE user_daily_usage (
  user_id         text          NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  day             date          NOT NULL,
  scored          integer       NOT NULL DEFAULT 0,
  filtered        jsonb         NOT NULL DEFAULT '{}',     -- hard-filter rejections by reason code, counters only (C-1)
  pipeline_usd    numeric(10,6) NOT NULL DEFAULT 0,
  interactive_usd numeric(10,6) NOT NULL DEFAULT 0,
  drafts          integer       NOT NULL DEFAULT 0,
  match_actions   integer       NOT NULL DEFAULT 0,
  autopilot_sends integer       NOT NULL DEFAULT 0,
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day),
  CONSTRAINT user_daily_usage_counts_ck   CHECK (scored >= 0 AND drafts >= 0 AND match_actions >= 0 AND autopilot_sends >= 0
                                                 AND pipeline_usd >= 0 AND interactive_usd >= 0),
  CONSTRAINT user_daily_usage_filtered_ck CHECK (jsonb_typeof(filtered) = 'object' AND octet_length(filtered::text) <= 1024)
) WITH (fillfactor = 80);
--> statement-breakpoint
-- 7.6.4 ai_usage (F11): per-feature daily allowance counters; limits only in shared/src/plans.ts; 90 days.
CREATE TABLE ai_usage (
  user_id    text        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  day        date        NOT NULL,
  feature    text        NOT NULL,
  used       integer     NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day, feature),
  CONSTRAINT ai_usage_feature_ck CHECK (feature IN ('resumeSuggestions','jobTailor','applicationDrafts','jobImports','rehearsalTurns')),
  CONSTRAINT ai_usage_used_ck    CHECK (used >= 0)
) WITH (fillfactor = 80);
--> statement-breakpoint
-- 7.3 kairos_jsonb_add: adds the numeric values of two flat JSON objects key by key (counters only;
-- a non-numeric value raises).
CREATE FUNCTION kairos_jsonb_add(a jsonb, b jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(jsonb_object_agg(k, to_jsonb(v)), '{}'::jsonb)
    FROM (SELECT k, sum(v::numeric) AS v
            FROM (SELECT key AS k, value AS v FROM jsonb_each_text(coalesce(a, '{}'::jsonb))
                  UNION ALL
                  SELECT key, value FROM jsonb_each_text(coalesce(b, '{}'::jsonb))) t
           GROUP BY k) s
$$;
--> statement-breakpoint
-- 7.2 llm_calls partitions and the cost roll-up.
CREATE FUNCTION llm_calls_ensure_partitions(p_weeks_ahead int DEFAULT 6) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_monday date := date_trunc('week', now() AT TIME ZONE 'UTC')::date;   -- ISO week starts on Monday
  v_lo date; v_hi date; v_name text; v_created int := 0;
BEGIN
  IF p_weeks_ahead NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'weeks_ahead out of range: %', p_weeks_ahead; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('llm_calls_partitions'));
  FOR i IN 0 .. p_weeks_ahead LOOP
    v_lo := v_monday + 7 * i;
    v_hi := v_lo + 7;
    v_name := 'llm_calls_' || to_char(v_lo, 'IYYY') || 'w' || to_char(v_lo, 'IW');
    IF to_regclass(format('public.%I', v_name)) IS NULL THEN
      EXECUTE format('CREATE TABLE public.%I PARTITION OF public.llm_calls FOR VALUES FROM (%L) TO (%L)',
                     v_name, v_lo::text || ' 00:00:00+00', v_hi::text || ' 00:00:00+00');
      v_created := v_created + 1;
    END IF;
  END LOOP;
  RETURN v_created;     -- fails loudly (and the alert fires) if llm_calls_default holds a row in a range being created
END $$;
--> statement-breakpoint
CREATE FUNCTION llm_calls_partition_rolled_up(p_partition text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_lo date; v_hi date; v_ok boolean;
BEGIN
  IF p_partition !~ '^llm_calls_[0-9]{4}w[0-9]{2}$' THEN RAISE EXCEPTION 'not a weekly partition name: %', p_partition; END IF;
  v_lo := to_date(substr(p_partition, 11, 4) || '-' || substr(p_partition, 16, 2), 'IYYY-IW');   -- the Monday of that ISO week
  v_hi := v_lo + 7;
  SELECT NOT EXISTS (                                      -- every day has a roll-up whose call count equals the rows it covers
    SELECT 1
      FROM (SELECT (created_at AT TIME ZONE 'UTC')::date AS day, count(*) AS n
              FROM llm_calls
             WHERE created_at >= v_lo::timestamp AT TIME ZONE 'UTC' AND created_at < v_hi::timestamp AT TIME ZONE 'UTC'
             GROUP BY 1) p
      LEFT JOIN (SELECT day, sum(calls) AS n FROM llm_cost_daily WHERE day >= v_lo AND day < v_hi GROUP BY day) d USING (day)
     WHERE d.n IS DISTINCT FROM p.n) INTO v_ok;
  RETURN v_ok;
END $$;
--> statement-breakpoint
CREATE FUNCTION llm_calls_drop_old_partitions(p_retention_days int DEFAULT 90) RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record; v_hi date; v_dropped text[] := '{}';
BEGIN
  IF p_retention_days < 90 THEN RAISE EXCEPTION 'retention below 90 days is not allowed'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('llm_calls_partitions'));
  PERFORM set_config('lock_timeout', '2s', true);
  FOR r IN SELECT c.relname FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid
            WHERE i.inhparent = 'public.llm_calls'::regclass AND c.relname ~ '^llm_calls_[0-9]{4}w[0-9]{2}$'
            ORDER BY c.relname
  LOOP
    v_hi := to_date(substr(r.relname, 11, 4) || '-' || substr(r.relname, 16, 2), 'IYYY-IW') + 7;
    CONTINUE WHEN v_hi > (now() AT TIME ZONE 'UTC')::date - p_retention_days;        -- every row is older than the retention window
    CONTINUE WHEN NOT llm_calls_partition_rolled_up(r.relname);                       -- and fully rolled up
    BEGIN
      EXECUTE format('ALTER TABLE public.llm_calls DETACH PARTITION public.%I', r.relname);
      EXECUTE format('DROP TABLE public.%I', r.relname);
      v_dropped := v_dropped || r.relname;
    EXCEPTION WHEN lock_not_available THEN
      NULL;                                                                           -- retried on the next run; the sub-transaction rolled the detach back
    END;
  END LOOP;
  RETURN v_dropped;
END $$;
--> statement-breakpoint
CREATE FUNCTION llm_cost_rollup_day(p_day date) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE v_rows integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('llm_cost_rollup'));                         -- a slow older run can never overwrite a newer one
  WITH up AS (
    INSERT INTO llm_cost_daily AS d (day, agent_id, workspace, plan, model, is_batch, calls,
           calls_ok, calls_schema_invalid, calls_max_tokens, calls_blocked, calls_error, calls_budget_stopped, calls_tiered_up,
           input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, cost_usd, latency_ms_sum, updated_at)
    SELECT p_day, agent_id, workspace, coalesce(plan::text, 'none'), model, is_batch, count(*),
           count(*) FILTER (WHERE status = 'ok'),            count(*) FILTER (WHERE status = 'schema_invalid'),
           count(*) FILTER (WHERE status = 'max_tokens'),    count(*) FILTER (WHERE status = 'blocked'),
           count(*) FILTER (WHERE status = 'error'),         count(*) FILTER (WHERE status = 'budget_stopped'),
           count(*) FILTER (WHERE tiered_up),
           sum(input_tokens), sum(cache_read_tokens), sum(cache_write_tokens), sum(output_tokens),
           sum(cost_usd), coalesce(sum(latency_ms), 0), now()
      FROM llm_calls
     WHERE created_at >= p_day::timestamp AT TIME ZONE 'UTC' AND created_at < (p_day + 1)::timestamp AT TIME ZONE 'UTC'
     GROUP BY agent_id, workspace, coalesce(plan::text, 'none'), model, is_batch
    ON CONFLICT (day, agent_id, workspace, plan, model, is_batch) DO UPDATE
       SET calls = EXCLUDED.calls, calls_ok = EXCLUDED.calls_ok, calls_schema_invalid = EXCLUDED.calls_schema_invalid,
           calls_max_tokens = EXCLUDED.calls_max_tokens, calls_blocked = EXCLUDED.calls_blocked, calls_error = EXCLUDED.calls_error,
           calls_budget_stopped = EXCLUDED.calls_budget_stopped, calls_tiered_up = EXCLUDED.calls_tiered_up,
           input_tokens = EXCLUDED.input_tokens, cache_read_tokens = EXCLUDED.cache_read_tokens,
           cache_write_tokens = EXCLUDED.cache_write_tokens, output_tokens = EXCLUDED.output_tokens,
           cost_usd = EXCLUDED.cost_usd, latency_ms_sum = EXCLUDED.latency_ms_sum, updated_at = now()
    RETURNING 1)
  SELECT count(*) INTO v_rows FROM up;
  RETURN v_rows;
END $$;
--> statement-breakpoint
-- Current week plus six ahead, so the first writes of the release always have a partition.
SELECT llm_calls_ensure_partitions(6);

-- stage_clear (WP-24 round 2): the recourse for a stage set by mail. Hand-written (drizzle-kit generate --custom); no
-- schema change. A reply can set `rejected`, which is final, and a same-ATS tenant or a replayed signed rejection can
-- still reach it, so the user who owns the application can clear it (POST /api/applications/:id/stage/clear).
--
-- applications_guard_stage as in 0009, with one new branch: a stage may become NULL only in a transaction marked as a
-- user action (asActor, set_config('kairos.actor', 'user', true)). The classify job, every other worker, and an operator
-- without the user's route set no such actor, so for them the stage stays forward-only and `rejected` stays final. The
-- previous release writes stage nowhere but forward, so it runs unchanged on this function.
CREATE OR REPLACE FUNCTION applications_guard_stage() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ranks text[] := ARRAY['applied','in_review','assessment','interviewing','offer'];
BEGIN
  IF NEW.stage IS NOT DISTINCT FROM OLD.stage THEN RETURN NEW; END IF;
  IF NEW.stage IS NULL AND kairos_actor() = 'user' THEN RETURN NEW; END IF;
  IF OLD.stage = 'rejected' THEN
    RAISE EXCEPTION 'stage rejected is final' USING ERRCODE = '23514', CONSTRAINT = 'applications_stage_guard';
  END IF;
  IF OLD.stage IS NULL OR NEW.stage = 'rejected' THEN RETURN NEW; END IF;
  IF NEW.stage IS NULL OR array_position(ranks, NEW.stage) <= array_position(ranks, OLD.stage) THEN
    RAISE EXCEPTION 'stage cannot move backward (% to %)', OLD.stage, NEW.stage USING ERRCODE = '23514', CONSTRAINT = 'applications_stage_guard';
  END IF;
  RETURN NEW;
END $$;

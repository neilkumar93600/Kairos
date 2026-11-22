CREATE TABLE "offer_pause_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"inbound_email_id" uuid NOT NULL,
	"application_id" uuid,
	"state" text DEFAULT 'pending' NOT NULL,
	"skip_reason" text,
	"apply_after" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offer_pause_state_ck" CHECK (state IN ('pending','applied','cancelled','skipped','failed')),
	CONSTRAINT "offer_pause_skip_reason_ck" CHECK (skip_reason IS NULL OR skip_reason IN ('already_paused','no_longer_offer')),
	CONSTRAINT "offer_pause_window_ck" CHECK (apply_after > created_at),
	CONSTRAINT "offer_pause_consistency_ck" CHECK ((state = 'pending' AND applied_at IS NULL AND cancelled_at IS NULL AND skip_reason IS NULL)
        OR (state = 'applied' AND applied_at IS NOT NULL AND cancelled_at IS NULL AND skip_reason IS NULL)
        OR (state = 'cancelled' AND cancelled_at IS NOT NULL AND applied_at IS NULL AND skip_reason IS NULL)
        OR (state = 'skipped' AND skip_reason IS NOT NULL AND applied_at IS NULL AND cancelled_at IS NULL)
        OR (state = 'failed' AND last_error IS NOT NULL AND applied_at IS NULL AND cancelled_at IS NULL)),
	CONSTRAINT "offer_pause_last_error_ck" CHECK (last_error IS NULL OR char_length(last_error) <= 120)
);
--> statement-breakpoint
ALTER TABLE "ops_flags" DROP CONSTRAINT "ops_flags_key_ck";--> statement-breakpoint
ALTER TABLE "offer_pause_candidates" ADD CONSTRAINT "offer_pause_candidates_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_pause_candidates" ADD CONSTRAINT "offer_pause_candidates_inbound_email_id_inbound_emails_id_fk" FOREIGN KEY ("inbound_email_id") REFERENCES "public"."inbound_emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_pause_candidates" ADD CONSTRAINT "offer_pause_candidates_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "offer_pause_candidates_email_uq" ON "offer_pause_candidates" USING btree ("inbound_email_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offer_pause_one_pending_uq" ON "offer_pause_candidates" USING btree ("user_id") WHERE state = 'pending';--> statement-breakpoint
CREATE INDEX "offer_pause_due_idx" ON "offer_pause_candidates" USING btree ("apply_after") WHERE state = 'pending';--> statement-breakpoint
CREATE INDEX "offer_pause_user_idx" ON "offer_pause_candidates" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "offer_pause_application_idx" ON "offer_pause_candidates" USING btree ("application_id") WHERE application_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE "ops_flags" ADD CONSTRAINT "ops_flags_key_ck" CHECK (key ~ '^(pause_cloud_apply|pause_scoring|llm_paused|approvals_frozen|cloud_applier_open|llm_shed_level|offer_pause_stripe|extension_only:(greenhouse|lever|ashby)|verifier_mode:(suggestions|tailor|drafts|prepare|patch)|(agent_disabled|prompt_pin|model_pin|prompt_canary|prompt_shadow):(resume-parser|jd-analyst|fit-scorer|resume-tailor|resume-writer|answer-drafter|cover-letter-writer|claim-verifier|claim-verifier-escalation|reply-classifier|outcome-analyst|interview-coach))$');
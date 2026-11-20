CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_status_ck" CHECK (status IN ('pending','enqueued','done','dead')),
	CONSTRAINT "outbox_key_ck" CHECK (dedupe_key ~ '^[A-Za-z0-9._-]{1,128}$'),
	CONSTRAINT "outbox_queue_ck" CHECK (queue ~ '^[a-z-]{1,40}$'),
	CONSTRAINT "outbox_payload_ck" CHECK (jsonb_typeof(payload) = 'object' AND pg_column_size(payload) <= 1024),
	CONSTRAINT "outbox_attempts_ck" CHECK (attempts >= 0),
	CONSTRAINT "outbox_error_ck" CHECK (last_error IS NULL OR last_error ~ '^[a-z0-9_]{1,40}$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_dedupe_key_uq" ON "outbox" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "outbox_live_idx" ON "outbox" USING btree ("status","available_at") WHERE "outbox"."status" <> 'done';
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"note" text,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics_minute" (
	"minute" timestamp with time zone NOT NULL,
	"name" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"value" double precision NOT NULL,
	CONSTRAINT "metrics_minute_minute_name_label_pk" PRIMARY KEY("minute","name","label")
);
--> statement-breakpoint
CREATE TABLE "ops_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"before" jsonb,
	"after" jsonb
);
--> statement-breakpoint
CREATE TABLE "ops_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ops_audit_at_idx" ON "ops_audit" USING btree ("at" DESC NULLS LAST);
CREATE TABLE "contact_jobs" (
	"contact_id" uuid NOT NULL,
	"tracker_item_id" uuid NOT NULL,
	CONSTRAINT "contact_jobs_contact_id_tracker_item_id_pk" PRIMARY KEY("contact_id","tracker_item_id")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"email" text,
	"phone" text,
	"linkedin_url" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contacts_text_ck" CHECK (char_length(name) BETWEEN 1 AND 120 AND char_length(title) <= 120 AND char_length(company) <= 200
        AND (email IS NULL OR char_length(email) <= 200) AND (phone IS NULL OR char_length(phone) <= 40)
        AND (linkedin_url IS NULL OR (char_length(linkedin_url) <= 300 AND linkedin_url ~* '^https?://')) AND char_length(notes) <= 5000)
);
--> statement-breakpoint
CREATE TABLE "interview_contacts" (
	"interview_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	CONSTRAINT "interview_contacts_interview_id_contact_id_pk" PRIMARY KEY("interview_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"tracker_item_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"time_zone" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"kind" text NOT NULL,
	"location" text,
	"notes" text DEFAULT '' NOT NULL,
	"outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interviews_kind_ck" CHECK (kind IN ('phone','video','onsite','assessment','other')),
	CONSTRAINT "interviews_text_ck" CHECK (char_length(time_zone) BETWEEN 1 AND 64 AND duration_minutes BETWEEN 5 AND 1440 AND (location IS NULL OR char_length(location) <= 500)
        AND char_length(notes) <= 5000 AND (outcome IS NULL OR char_length(outcome) <= 500))
);
--> statement-breakpoint
CREATE TABLE "tracker_projector_state" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"last_event_id" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracker_projector_state_one_ck" CHECK (id = 1)
);
--> statement-breakpoint
ALTER TABLE "tracker_items" ALTER COLUMN "position" SET DEFAULT 't' || lpad(to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint), 12, '0');--> statement-breakpoint
ALTER TABLE "tracker_items" ADD COLUMN "user_moved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contact_jobs" ADD CONSTRAINT "contact_jobs_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_jobs" ADD CONSTRAINT "contact_jobs_tracker_item_id_tracker_items_id_fk" FOREIGN KEY ("tracker_item_id") REFERENCES "public"."tracker_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_contacts" ADD CONSTRAINT "interview_contacts_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_contacts" ADD CONSTRAINT "interview_contacts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_tracker_item_id_tracker_items_id_fk" FOREIGN KEY ("tracker_item_id") REFERENCES "public"."tracker_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_jobs_item_idx" ON "contact_jobs" USING btree ("tracker_item_id");--> statement-breakpoint
CREATE INDEX "contacts_user_idx" ON "contacts" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "interview_contacts_contact_idx" ON "interview_contacts" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "interviews_user_starts_idx" ON "interviews" USING btree ("user_id","starts_at","id");--> statement-breakpoint
CREATE INDEX "interviews_item_starts_idx" ON "interviews" USING btree ("tracker_item_id","starts_at");
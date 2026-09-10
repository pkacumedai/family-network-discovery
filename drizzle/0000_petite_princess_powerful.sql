CREATE TYPE "public"."event_type" AS ENUM('session_started', 'graph_viewed', 'graph_zoomed', 'graph_panned', 'graph_layout_changed', 'person_searched', 'search_result_selected', 'person_selected', 'identity_claim_started', 'identity_claimed', 'identity_not_found', 'person_created', 'relationship_created', 'onboarding_completed');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('INVITED', 'JOINED');--> statement-breakpoint
CREATE TYPE "public"."onboarding_state" AS ENUM('UNCLAIMED', 'PRELINKED', 'IN_PROGRESS', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."relationship_status" AS ENUM('SEEDED', 'UNVERIFIED', 'VERIFIED');--> statement-breakpoint
CREATE TYPE "public"."relationship_type" AS ENUM('PARENT_OF', 'SPOUSE_OF', 'SIBLING_OF');--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"member_id" text,
	"event_type" "event_type" NOT NULL,
	"related_person_id" text,
	"related_relationship_id" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"status" "member_status" DEFAULT 'INVITED' NOT NULL,
	"linked_person_id" text,
	"onboarding_state" "onboarding_state" DEFAULT 'UNCLAIMED' NOT NULL,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_linked_person_id_unique" UNIQUE("linked_person_id"),
	CONSTRAINT "member_name_present" CHECK (length(trim("members"."display_name")) > 0),
	CONSTRAINT "member_email_present" CHECK (length(trim("members"."email")) > 0),
	CONSTRAINT "member_onboarding_link" CHECK (("members"."onboarding_state" = 'UNCLAIMED' AND "members"."linked_person_id" IS NULL) OR ("members"."onboarding_state" = 'IN_PROGRESS') OR ("members"."onboarding_state" IN ('PRELINKED', 'COMPLETED') AND "members"."linked_person_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"birth_date" date,
	"is_living" boolean,
	"nickname" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_member_id" text,
	CONSTRAINT "person_name_present" CHECK (length(trim("people"."display_name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "profile_privacy" (
	"person_id" text PRIMARY KEY NOT NULL,
	"share_birth_month_day" boolean DEFAULT false NOT NULL,
	"share_birth_year" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" text PRIMARY KEY NOT NULL,
	"from_person_id" text NOT NULL,
	"to_person_id" text NOT NULL,
	"relationship_type" "relationship_type" NOT NULL,
	"status" "relationship_status" DEFAULT 'UNVERIFIED' NOT NULL,
	"created_by_member_id" text,
	"seed_source" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relationship_no_self" CHECK ("relationships"."from_person_id" <> "relationships"."to_person_id"),
	CONSTRAINT "relationship_provenance" CHECK (("relationships"."created_by_member_id" IS NOT NULL AND "relationships"."seed_source" IS NULL) OR ("relationships"."created_by_member_id" IS NULL AND length(trim("relationships"."seed_source")) > 0 AND "relationships"."seed_source" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_related_person_id_people_id_fk" FOREIGN KEY ("related_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_related_relationship_id_relationships_id_fk" FOREIGN KEY ("related_relationship_id") REFERENCES "public"."relationships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_linked_person_id_people_id_fk" FOREIGN KEY ("linked_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_privacy" ADD CONSTRAINT "profile_privacy_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_from_person_id_people_id_fk" FOREIGN KEY ("from_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_to_person_id_people_id_fk" FOREIGN KEY ("to_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_timestamp_idx" ON "events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "events_member_idx" ON "events" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_email_unique" ON "members" USING btree (lower(trim("email")));--> statement-breakpoint
CREATE UNIQUE INDEX "relationship_canonical_unique" ON "relationships" USING btree ("relationship_type",(CASE WHEN "relationship_type" = 'PARENT_OF' THEN "from_person_id" ELSE least("from_person_id", "to_person_id") END),(CASE WHEN "relationship_type" = 'PARENT_OF' THEN "to_person_id" ELSE greatest("from_person_id", "to_person_id") END));--> statement-breakpoint
CREATE INDEX "relationship_from_idx" ON "relationships" USING btree ("from_person_id");--> statement-breakpoint
CREATE INDEX "relationship_to_idx" ON "relationships" USING btree ("to_person_id");
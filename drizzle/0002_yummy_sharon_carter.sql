CREATE TYPE "public"."access_status" AS ENUM('ACTIVE', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."family_role" AS ENUM('MEMBER', 'ADMIN');--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'auth_started';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'auth_succeeded';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'auth_failed';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'family_accessed';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'onboarding_started';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'identity_claim_succeeded';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'identity_claim_failed';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'explorer_viewed';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'logout';--> statement-breakpoint
CREATE TABLE "app_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"auth_user_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_accounts_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
CREATE TABLE "family_admissions" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"family_id" text NOT NULL,
	"role" "family_role" DEFAULT 'MEMBER' NOT NULL,
	"status" "access_status" DEFAULT 'ACTIVE' NOT NULL,
	"bound_account_id" text,
	"legacy_member_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "family_admissions_legacy_member_id_unique" UNIQUE("legacy_member_id"),
	CONSTRAINT "admission_id_family_unique" UNIQUE("id","family_id")
);
--> statement-breakpoint
CREATE TABLE "families" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_account_id" text
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"family_id" text NOT NULL,
	"admission_id" text NOT NULL,
	"status" "access_status" DEFAULT 'ACTIVE' NOT NULL,
	"role" "family_role" DEFAULT 'MEMBER' NOT NULL,
	"person_id" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_account_family_unique" UNIQUE("account_id","family_id")
);
--> statement-breakpoint
CREATE TABLE "auth_credential" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "auth_rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "auth_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "members" RENAME TO "legacy_member_records";--> statement-breakpoint
ALTER TABLE "legacy_member_records" DROP CONSTRAINT "members_linked_person_id_unique";--> statement-breakpoint
ALTER TABLE "legacy_member_records" DROP CONSTRAINT "member_name_present";--> statement-breakpoint
ALTER TABLE "legacy_member_records" DROP CONSTRAINT "member_email_present";--> statement-breakpoint
ALTER TABLE "legacy_member_records" DROP CONSTRAINT "member_onboarding_link";--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT "events_member_id_members_id_fk";
--> statement-breakpoint
ALTER TABLE "legacy_member_records" DROP CONSTRAINT "members_linked_person_id_people_id_fk";
--> statement-breakpoint
ALTER TABLE "people" DROP CONSTRAINT "people_created_by_member_id_members_id_fk";
--> statement-breakpoint
ALTER TABLE "relationships" DROP CONSTRAINT "relationships_created_by_member_id_members_id_fk";
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "family_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "account_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "membership_id" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "family_id" text NOT NULL DEFAULT 'sample-family';--> statement-breakpoint
ALTER TABLE "relationships" ADD COLUMN "family_id" text NOT NULL DEFAULT 'sample-family';--> statement-breakpoint
INSERT INTO families (id, name) VALUES ('sample-family', 'Sample Family');
--> statement-breakpoint
ALTER TABLE people ALTER COLUMN family_id DROP DEFAULT;
ALTER TABLE relationships ALTER COLUMN family_id DROP DEFAULT;
UPDATE events SET family_id = 'sample-family';
INSERT INTO family_admissions (id, email, family_id, legacy_member_id, created_at)
SELECT id, lower(trim(email)), 'sample-family', id, created_at FROM legacy_member_records;
--> statement-breakpoint
ALTER TABLE "app_accounts" ADD CONSTRAINT "app_accounts_auth_user_id_auth_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_admissions" ADD CONSTRAINT "family_admissions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_admissions" ADD CONSTRAINT "family_admissions_bound_account_id_app_accounts_id_fk" FOREIGN KEY ("bound_account_id") REFERENCES "public"."app_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_admissions" ADD CONSTRAINT "family_admissions_legacy_member_id_legacy_member_records_id_fk" FOREIGN KEY ("legacy_member_id") REFERENCES "public"."legacy_member_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "families" ADD CONSTRAINT "families_created_by_account_id_app_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."app_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_account_id_app_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."app_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "person_family_id_unique" UNIQUE("family_id","id");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "membership_person_family_fk" FOREIGN KEY ("family_id","person_id") REFERENCES "public"."people"("family_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "membership_admission_family_fk" FOREIGN KEY ("admission_id","family_id") REFERENCES "public"."family_admissions"("id","family_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_credential" ADD CONSTRAINT "auth_credential_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admission_family_email_unique" ON "family_admissions" USING btree ("family_id",lower(trim("email")));--> statement-breakpoint
CREATE UNIQUE INDEX "membership_active_person_unique" ON "memberships" USING btree ("family_id","person_id") WHERE "memberships"."status" = 'ACTIVE' AND "memberships"."person_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "auth_session_user_idx" ON "auth_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_verification_identifier_idx" ON "auth_verification" USING btree ("identifier");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_account_id_app_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."app_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_member_id_legacy_member_records_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."legacy_member_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_member_records" ADD CONSTRAINT "legacy_member_records_linked_person_id_people_id_fk" FOREIGN KEY ("linked_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_created_by_member_id_legacy_member_records_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."legacy_member_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_created_by_member_id_legacy_member_records_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."legacy_member_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationship_from_family_fk" FOREIGN KEY ("family_id","from_person_id") REFERENCES "public"."people"("family_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationship_to_family_fk" FOREIGN KEY ("family_id","to_person_id") REFERENCES "public"."people"("family_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_member_records" ADD CONSTRAINT "legacy_member_records_linked_person_id_unique" UNIQUE("linked_person_id");--> statement-breakpoint
ALTER TABLE "legacy_member_records" ADD CONSTRAINT "member_name_present" CHECK (length(trim("legacy_member_records"."display_name")) > 0);--> statement-breakpoint
ALTER TABLE "legacy_member_records" ADD CONSTRAINT "member_email_present" CHECK (length(trim("legacy_member_records"."email")) > 0);--> statement-breakpoint
ALTER TABLE "legacy_member_records" ADD CONSTRAINT "member_onboarding_link" CHECK (("legacy_member_records"."onboarding_state" = 'UNCLAIMED' AND "legacy_member_records"."linked_person_id" IS NULL) OR ("legacy_member_records"."onboarding_state" = 'IN_PROGRESS') OR ("legacy_member_records"."onboarding_state" IN ('PRELINKED', 'COMPLETED') AND "legacy_member_records"."linked_person_id" IS NOT NULL));
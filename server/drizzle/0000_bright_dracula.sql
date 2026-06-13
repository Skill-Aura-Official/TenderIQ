CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"org_id" uuid NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"details" text,
	"ip_address" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"org_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"gst_number" text,
	"pan_number" text,
	"msme_registered" boolean DEFAULT false NOT NULL,
	"incorporation_year" integer,
	"operating_states" text[] NOT NULL,
	"services_keywords" text[] NOT NULL,
	"past_client_types" text[],
	"max_tender_capacity" numeric NOT NULL,
	"certifications" text[] NOT NULL,
	"company_embedding" "vector(1024)",
	"scoring_version" integer DEFAULT 1 NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "company_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"org_id" uuid,
	"tender_id" uuid,
	"event_type" text NOT NULL,
	"channel" text NOT NULL,
	"status" text NOT NULL,
	"external_id" text,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"failed_reason" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"ban_reason" text,
	"allowed_features" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pipeline_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"org_id" uuid NOT NULL,
	"tender_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"notes" text,
	"stage_history" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recommendation_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"status" text NOT NULL,
	"notified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recommendation_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recommendation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"signal" text NOT NULL,
	"category_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"tender_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price_monthly" integer NOT NULL,
	"price_annual" integer NOT NULL,
	"razorpay_monthly_plan_id" text,
	"razorpay_annual_plan_id" text,
	"tender_limit" integer,
	"team_seats" integer DEFAULT 1,
	"has_ai_summary" boolean DEFAULT false,
	"has_whatsapp" boolean DEFAULT false,
	"has_vault" boolean DEFAULT false,
	"has_pipeline" boolean DEFAULT false,
	"has_api_access" boolean DEFAULT false,
	"priority_scraping" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tender_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tender_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"assigned_by" text NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"portal_slug" text NOT NULL,
	"portal_tender_id" text NOT NULL,
	"nit_number" text,
	"issuing_authority" text NOT NULL,
	"title" text NOT NULL,
	"category_codes" text NOT NULL,
	"state_codes" text NOT NULL,
	"estimated_value" numeric,
	"emd_amount" numeric,
	"submission_deadline" timestamp NOT NULL,
	"document_open_date" timestamp,
	"summary_status" text NOT NULL,
	"ai_summary" text,
	"eligibility_criteria" text,
	"required_documents" text NOT NULL,
	"raw_pdf_gcs_key" text,
	"raw_text" text,
	"source_url" text NOT NULL,
	"is_cancelled" boolean DEFAULT false NOT NULL,
	"last_scraped_at" timestamp DEFAULT now() NOT NULL,
	"source_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"embedding" "vector(1024)",
	CONSTRAINT "tenders_source_hash_unique" UNIQUE("source_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_tender_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"tender_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"breakdown" text NOT NULL,
	"missing_criteria" text NOT NULL,
	"scored_at" timestamp DEFAULT now() NOT NULL,
	"profile_version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"subscription_tier" text DEFAULT 'free' NOT NULL,
	"razorpay_customer_id" text,
	"razorpay_subscription_id" text,
	"subscription_status" text DEFAULT 'free' NOT NULL,
	"trial_ends_at" timestamp,
	"org_id" uuid NOT NULL,
	"whatsapp_opt_in" boolean DEFAULT false NOT NULL,
	"channel_opt_out_email" boolean DEFAULT false NOT NULL,
	"channel_opt_out_whatsapp" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vault_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"org_id" uuid NOT NULL,
	"doc_type" text NOT NULL,
	"display_name" text NOT NULL,
	"gcs_key" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"verification_status" text DEFAULT 'pending' NOT NULL,
	"verification_notes" text,
	"ocr_extracted_data" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pipeline_entries" ADD CONSTRAINT "pipeline_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pipeline_entries" ADD CONSTRAINT "pipeline_entries_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pipeline_entries" ADD CONSTRAINT "pipeline_entries_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recommendation_batches" ADD CONSTRAINT "recommendation_batches_company_id_company_profiles_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_company_id_company_profiles_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tender_assignments" ADD CONSTRAINT "tender_assignments_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tender_assignments" ADD CONSTRAINT "tender_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tender_assignments" ADD CONSTRAINT "tender_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenders" ADD CONSTRAINT "tenders_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenders" ADD CONSTRAINT "tenders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_tender_scores" ADD CONSTRAINT "user_tender_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_tender_scores" ADD CONSTRAINT "user_tender_scores_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vault_documents" ADD CONSTRAINT "vault_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vault_documents" ADD CONSTRAINT "vault_documents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

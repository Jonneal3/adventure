CREATE SCHEMA "app_auth";
--> statement-breakpoint
CREATE TABLE "app_auth"."account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
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
CREATE TABLE "app_auth"."session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_auth"."user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_auth"."verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adventure_account_billing" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"plan_code" text DEFAULT 'usage' NOT NULL,
	"status" text DEFAULT 'trialing' NOT NULL,
	"period_start" timestamp with time zone DEFAULT now() NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"engagements_used" integer DEFAULT 0 NOT NULL,
	"ai_designs_used" integer DEFAULT 0 NOT NULL,
	"wallet_balance_cents" integer DEFAULT 0 NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text
);
--> statement-breakpoint
CREATE TABLE "adventure_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"project_id" uuid,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"purpose" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adventure_engagements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"source" text NOT NULL,
	"charge_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adventure_experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"draft" jsonb NOT NULL,
	"published" jsonb,
	"legacy_config" jsonb,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adventure_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"charge_source" text NOT NULL,
	"charge_cents" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adventure_plans" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"monthly_price_cents" integer NOT NULL,
	"included_engagements" integer NOT NULL,
	"overage_engagement_price_cents" integer NOT NULL,
	"included_ai_designs" integer NOT NULL,
	"extra_ai_design_price_cents" integer NOT NULL,
	"included_instances" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adventure_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"instance_id" uuid NOT NULL,
	"visitor_token_hash" text NOT NULL,
	"is_preview" boolean DEFAULT false NOT NULL,
	"experience_revision" integer NOT NULL,
	"experience_snapshot" jsonb NOT NULL,
	"service_id" uuid,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"revealed_range" jsonb,
	"quote_requested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adventure_service_presets" (
	"service_id" uuid PRIMARY KEY NOT NULL,
	"industry_id" uuid NOT NULL,
	"visual_job" text DEFAULT 'none' NOT NULL,
	"default_range" jsonb,
	"elements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"curated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "adventure_stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adventure_wallet_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"operation_key" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"kind" text NOT NULL,
	"project_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_auth"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_auth"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_auth_account_provider_idx" ON "app_auth"."account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_auth_session_token_idx" ON "app_auth"."session" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "app_auth_user_email_idx" ON "app_auth"."user" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "adventure_assets_key_unique" ON "adventure_assets" USING btree ("object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "adventure_engagements_project_unique" ON "adventure_engagements" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "adventure_experiences_instance_unique" ON "adventure_experiences" USING btree ("instance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "adventure_jobs_request_unique" ON "adventure_jobs" USING btree ("project_id","request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "adventure_wallet_operation_unique" ON "adventure_wallet_entries" USING btree ("operation_key");
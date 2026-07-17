CREATE TYPE "public"."call_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."call_sentiment" AS ENUM('positive', 'neutral', 'negative', 'inquisitive');--> statement-breakpoint
CREATE TYPE "public"."call_status" AS ENUM('ringing', 'in-progress', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."email_sent_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('pending', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'payment_overdue', 'suspended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('pilot', 'standard', 'pro');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('pending_payment', 'active', 'suspended');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"call_id" varchar(128) NOT NULL,
	"customer_name" varchar(256),
	"customer_email" varchar(256),
	"customer_phone" varchar(32),
	"intake_data" jsonb NOT NULL,
	"booking_time" timestamp with time zone DEFAULT now(),
	"email_sent_status" "email_sent_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"direction" "call_direction" NOT NULL,
	"status" "call_status" NOT NULL,
	"phone_number" varchar(32) NOT NULL,
	"duration_seconds" integer,
	"recording_url" varchar(1024),
	"transcript" jsonb,
	"summary" text,
	"sentiment" "call_sentiment",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"subscription_id" varchar(64) NOT NULL,
	"amount_usd" numeric(10, 2) NOT NULL,
	"overage_minutes" integer DEFAULT 0 NOT NULL,
	"overage_charge_usd" numeric(10, 2) DEFAULT '0' NOT NULL,
	"polar_order_id" varchar(128),
	"status" "invoice_status" NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now(),
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"tier" "subscription_tier" NOT NULL,
	"monthly_price_usd" numeric(10, 2) NOT NULL,
	"minute_cap" integer NOT NULL,
	"overage_rate_per_minute_usd" numeric(6, 2) DEFAULT '0.27' NOT NULL,
	"minutes_used_this_cycle" integer DEFAULT 0 NOT NULL,
	"polar_customer_id" varchar(128),
	"polar_subscription_id" varchar(128),
	"status" "subscription_status" NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"overdue_since" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"slug" varchar(128) NOT NULL,
	"name" varchar(256) NOT NULL,
	"owner_email" varchar(256) NOT NULL,
	"business_type" varchar(64) NOT NULL,
	"intake_schema" jsonb NOT NULL,
	"status" "tenant_status" DEFAULT 'pending_payment' NOT NULL,
	"selected_tier" "subscription_tier",
	"polar_customer_reference" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_tenant_id_idx" ON "bookings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "bookings_call_id_idx" ON "bookings" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "calls_tenant_id_idx" ON "calls" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calls_id_unique_idx" ON "calls" USING btree ("id");--> statement-breakpoint
CREATE INDEX "invoices_tenant_id_idx" ON "invoices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "invoices_subscription_id_idx" ON "invoices" USING btree ("subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_tenant_id_idx" ON "subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_slug_idx" ON "tenants" USING btree ("slug");
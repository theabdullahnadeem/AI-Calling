CREATE TYPE "public"."user_role" AS ENUM('tenant_owner', 'admin');--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64),
	"email" varchar(256) NOT NULL,
	"password_hash" varchar(256),
	"role" "user_role" DEFAULT 'tenant_owner' NOT NULL,
	"set_password_token" varchar(128),
	"set_password_token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_admin_or_tenant_check" CHECK ("users"."role" = 'admin' OR "users"."tenant_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "payment_link_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_tenant_id_idx" ON "users" USING btree ("tenant_id");
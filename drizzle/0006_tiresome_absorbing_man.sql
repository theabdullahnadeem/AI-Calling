ALTER TYPE "public"."user_role" ADD VALUE 'partner_admin';--> statement-breakpoint
CREATE TABLE "partners" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"support_email" varchar(256) NOT NULL,
	"billing_email" varchar(256) NOT NULL,
	"logo_key" varchar(256),
	"accent_color" varchar(16),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_admin_or_tenant_check";--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "partner_id" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "partner_id" varchar(64);--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenants_partner_id_idx" ON "tenants" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "users_partner_id_idx" ON "users" USING btree ("partner_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_admin_or_tenant_check" CHECK ("users"."role"::text IN ('admin', 'staff_admin') OR ("users"."role"::text = 'tenant_owner' AND "users"."tenant_id" IS NOT NULL) OR ("users"."role"::text = 'partner_admin' AND "users"."partner_id" IS NOT NULL));
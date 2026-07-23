ALTER TYPE "public"."user_role" ADD VALUE 'staff_admin';--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_admin_or_tenant_check";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_admin_or_tenant_check" CHECK ("users"."role"::text IN ('admin', 'staff_admin') OR "users"."tenant_id" IS NOT NULL);
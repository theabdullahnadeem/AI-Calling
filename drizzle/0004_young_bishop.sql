CREATE TABLE "suppressed_numbers" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"phone_number" varchar(32) NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "consent_basis" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "outbound_calling_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "consent_basis" text;--> statement-breakpoint
ALTER TABLE "suppressed_numbers" ADD CONSTRAINT "suppressed_numbers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "suppressed_numbers_tenant_id_idx" ON "suppressed_numbers" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suppressed_numbers_tenant_phone_idx" ON "suppressed_numbers" USING btree ("tenant_id","phone_number");
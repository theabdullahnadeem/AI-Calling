ALTER TABLE "tenants" ADD COLUMN "retell_agent_id" varchar(128);--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_retell_agent_id_idx" ON "tenants" USING btree ("retell_agent_id");
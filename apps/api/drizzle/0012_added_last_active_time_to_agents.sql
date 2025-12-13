ALTER TABLE "gpr_agents" ADD COLUMN "consecutive_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "gpr_agents" ADD COLUMN "registered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gpr_agents" ADD COLUMN "last_stream_connected_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "agents_org_host_idx" ON "gpr_agents" USING btree ("org_id","host");
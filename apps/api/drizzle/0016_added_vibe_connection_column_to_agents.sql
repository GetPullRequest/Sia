ALTER TABLE "gpr_activities" ADD COLUMN "agent_id" varchar(255);--> statement-breakpoint
ALTER TABLE "gpr_agents" ADD COLUMN "vibe_connection_id" uuid;--> statement-breakpoint
ALTER TABLE "gpr_jobs" ADD COLUMN "agent_id" varchar(255);--> statement-breakpoint
CREATE INDEX "activities_agent_id_idx" ON "gpr_activities" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agents_vibe_connection_id_idx" ON "gpr_agents" USING btree ("vibe_connection_id");--> statement-breakpoint
CREATE INDEX "jobs_agent_id_idx" ON "gpr_jobs" USING btree ("agent_id");
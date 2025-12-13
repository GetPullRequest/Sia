CREATE TYPE "public"."gpr_vibe_agent" AS ENUM('cursor', 'kiro-cli', 'claude-code');--> statement-breakpoint
ALTER TABLE "gpr_agents" ADD COLUMN "vibe_agent" "gpr_vibe_agent";--> statement-breakpoint
ALTER TABLE "gpr_agents" ADD COLUMN "vibe_agent_executable_path" varchar(500);--> statement-breakpoint
ALTER TABLE "gpr_jobs" ADD COLUMN "code_generation_detail_logs" varchar(10000);
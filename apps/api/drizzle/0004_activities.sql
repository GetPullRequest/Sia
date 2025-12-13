CREATE TYPE "public"."gpr_activity_status" AS ENUM('pr_created', 'in_progress', 'completed', 'failed', 'queued', 'sent_for_rework');--> statement-breakpoint
CREATE TABLE "gpr_activities" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" "gpr_activity_status" DEFAULT 'queued' NOT NULL,
	"job_id" varchar(255) NOT NULL,
	"summary" varchar(2000),
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(255) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code_generation_logs" varchar(1000),
	"verification_logs" varchar(1000)
);
--> statement-breakpoint
CREATE INDEX "activities_job_id_idx" ON "gpr_activities" USING btree ("job_id");
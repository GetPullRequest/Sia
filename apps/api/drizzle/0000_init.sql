CREATE TYPE "public"."gpr_job_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."gpr_job_status" AS ENUM('queued', 'in-progress', 'completed', 'failed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."gpr_user_acceptance_status" AS ENUM('not_reviewed', 'reviewed_and_accepted', 'reviewed_and_asked_rework', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."gpr_user_input_source" AS ENUM('slack', 'discord', 'mobile', 'gh-issues');--> statement-breakpoint
CREATE TABLE "gpr_jobs" (
	"id" varchar(255) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"generated_name" varchar(500),
	"generated_description" varchar(2000),
	"status" "gpr_job_status" DEFAULT 'queued' NOT NULL,
	"priority" "gpr_job_priority" DEFAULT 'medium' NOT NULL,
	"order_in_queue" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_by" varchar(255) NOT NULL,
	"code_generation_logs" varchar(1000),
	"code_verification_logs" varchar(1000),
	"user_input" jsonb,
	"repo_id" varchar(255),
	"user_acceptance_status" "gpr_user_acceptance_status" DEFAULT 'not_reviewed' NOT NULL,
	"user_comments" jsonb,
	"confidence_score" varchar(50),
	"pr_link" varchar(500),
	CONSTRAINT "gpr_jobs_id_version_pk" PRIMARY KEY("id","version")
);

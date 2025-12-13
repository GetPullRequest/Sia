CREATE TYPE "public"."gpr_repo_provider_app_name" AS ENUM('github', 'gitlab', 'bitbucket');--> statement-breakpoint
CREATE TABLE "gpr_job_logs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"job_id" varchar(255) NOT NULL,
	"version" integer NOT NULL,
	"level" varchar(20) NOT NULL,
	"message" varchar(2000) NOT NULL,
	"stage" varchar(100),
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gpr_repo_providers" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(2000),
	"access_token" varchar(255),
	"refresh_token" varchar(255),
	"expires_in" integer DEFAULT 0 NOT NULL,
	"token_created_at" timestamp with time zone,
	"metadata" jsonb,
	"repo_provider_app_name" "gpr_repo_provider_app_name" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gpr_repos" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(2000),
	"url" varchar(255) NOT NULL,
	"repo_provider_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "job_logs_job_id_idx" ON "gpr_job_logs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_logs_job_version_idx" ON "gpr_job_logs" USING btree ("job_id","version");--> statement-breakpoint
CREATE INDEX "job_logs_timestamp_idx" ON "gpr_job_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "job_logs_stage_idx" ON "gpr_job_logs" USING btree ("stage");
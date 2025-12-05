CREATE TYPE "public"."gpr_queue_type" AS ENUM('rework', 'backlog');--> statement-breakpoint
CREATE TABLE "gpr_conversations" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"platform" varchar(50) NOT NULL,
	"channel_id" varchar(255) NOT NULL,
	"thread_id" varchar(255),
	"user_id" varchar(255) NOT NULL,
	"org_id" varchar(255) NOT NULL,
	"messages" jsonb,
	"last_message_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gpr_files" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"org_id" varchar(255) NOT NULL,
	"job_id" varchar(255),
	"file_name" varchar(500) NOT NULL,
	"mime_type" varchar(100),
	"size" integer NOT NULL,
	"gcs_path" varchar(1000) NOT NULL,
	"uploaded_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gpr_jobs" ALTER COLUMN "order_in_queue" SET DEFAULT -1;--> statement-breakpoint
ALTER TABLE "gpr_jobs" ADD COLUMN "queue_type" "gpr_queue_type";--> statement-breakpoint
CREATE INDEX "conversations_platform_thread_idx" ON "gpr_conversations" USING btree ("platform","thread_id");--> statement-breakpoint
CREATE INDEX "conversations_org_id_idx" ON "gpr_conversations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "conversations_channel_id_idx" ON "gpr_conversations" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "files_org_id_idx" ON "gpr_files" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "files_job_id_idx" ON "gpr_files" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "jobs_queue_type_idx" ON "gpr_jobs" USING btree ("org_id","queue_type","order_in_queue");
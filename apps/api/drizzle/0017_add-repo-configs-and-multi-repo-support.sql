CREATE TYPE "public"."gpr_execution_strategy" AS ENUM('auto', 'devcontainer', 'docker-compose', 'custom');--> statement-breakpoint
CREATE TABLE "gpr_repo_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" varchar(255) NOT NULL,
	"org_id" varchar(255) NOT NULL,
	"execution_strategy" "gpr_execution_strategy",
	"setup_commands" text[],
	"build_commands" text[],
	"test_commands" text[],
	"validation_strategy" jsonb DEFAULT '{"runBuild":true,"runTests":true,"runLinter":false}'::jsonb,
	"env_vars_needed" text[],
	"detected_language" varchar(100),
	"detected_from" varchar(255),
	"devcontainer_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gpr_jobs" ADD COLUMN "repos" text[];--> statement-breakpoint
CREATE INDEX "repo_configs_repo_id_idx" ON "gpr_repo_configs" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "repo_configs_org_id_idx" ON "gpr_repo_configs" USING btree ("org_id");
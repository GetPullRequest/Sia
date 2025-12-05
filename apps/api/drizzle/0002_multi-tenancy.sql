ALTER TABLE "gpr_job_logs" ADD COLUMN "org_id" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "gpr_jobs" ADD COLUMN "org_id" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "gpr_repo_providers" ADD COLUMN "org_id" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "gpr_repos" ADD COLUMN "org_id" varchar(255) NOT NULL;--> statement-breakpoint
CREATE INDEX "job_logs_org_id_idx" ON "gpr_job_logs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "jobs_org_id_idx" ON "gpr_jobs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "repo_providers_org_id_idx" ON "gpr_repo_providers" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "repos_org_id_idx" ON "gpr_repos" USING btree ("org_id");
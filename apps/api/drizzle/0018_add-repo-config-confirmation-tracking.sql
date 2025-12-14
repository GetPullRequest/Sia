ALTER TABLE "gpr_repo_configs" ADD COLUMN "is_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "gpr_repo_configs" ADD COLUMN "inferred_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gpr_repo_configs" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gpr_repo_configs" ADD COLUMN "inference_source" varchar(100);--> statement-breakpoint
ALTER TABLE "gpr_repo_configs" ADD COLUMN "inference_confidence" varchar(20);
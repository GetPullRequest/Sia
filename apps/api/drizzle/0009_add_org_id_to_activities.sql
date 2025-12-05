CREATE TYPE "public"."gpr_activity_read_status" AS ENUM('read', 'unread');--> statement-breakpoint
CREATE TABLE "gpr_user_activity_read_status" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"activity_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"org_id" varchar(255) NOT NULL,
	"read_status" "gpr_activity_read_status" DEFAULT 'unread' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gpr_activities" ALTER COLUMN "summary" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "gpr_activities" ADD COLUMN "org_id" varchar(255);--> statement-breakpoint
UPDATE "gpr_activities" SET "org_id" = '916b6662-0f9f-4651-b7f4-c02d88c1fdd6' WHERE "org_id" IS NULL;--> statement-breakpoint
ALTER TABLE "gpr_activities" ALTER COLUMN "org_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "user_activity_read_status_activity_user_idx" ON "gpr_user_activity_read_status" USING btree ("activity_id","user_id");--> statement-breakpoint
CREATE INDEX "user_activity_read_status_org_user_idx" ON "gpr_user_activity_read_status" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "activities_org_id_idx" ON "gpr_activities" USING btree ("org_id");--> statement-breakpoint
ALTER TABLE "gpr_activities" DROP COLUMN "status";--> statement-breakpoint
DROP TYPE "public"."gpr_activity_status";
CREATE TABLE "gpr_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"provider_type" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"provider_team_id" varchar(255),
	"provider_user_id" varchar(255),
	"access_token" varchar(2000),
	"refresh_token" varchar(2000),
	"expires_in" integer,
	"token_created_at" timestamp with time zone,
	"management_url" varchar(500),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_gpr_integrations_org_id" ON "gpr_integrations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_gpr_integrations_provider_type" ON "gpr_integrations" USING btree ("provider_type");--> statement-breakpoint
CREATE INDEX "idx_gpr_integrations_team" ON "gpr_integrations" USING btree ("provider_team_id");
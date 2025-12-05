CREATE TABLE "gpr_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"key_prefix" varchar(20) NOT NULL,
	"secret_value" varchar(2000) NOT NULL,
	"storage_type" varchar(20) NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "api_keys_org_id_idx" ON "gpr_api_keys" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "api_keys_user_id_idx" ON "gpr_api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_keys_key_prefix_idx" ON "gpr_api_keys" USING btree ("key_prefix");
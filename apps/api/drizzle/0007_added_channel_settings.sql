CREATE TABLE "gpr_channel_settings" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"platform" varchar(50) NOT NULL,
	"channel_id" varchar(255) NOT NULL,
	"thread_id" varchar(255),
	"org_id" varchar(255) NOT NULL,
	"is_quiet" boolean DEFAULT false NOT NULL,
	"quiet_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "channel_settings_lookup_idx" ON "gpr_channel_settings" USING btree ("platform","channel_id","thread_id","org_id");
ALTER TABLE "gpr_api_keys" ADD COLUMN "key_hash" varchar(255) NOT NULL;--> statement-breakpoint
CREATE INDEX "api_keys_key_hash_idx" ON "gpr_api_keys" USING btree ("key_hash");
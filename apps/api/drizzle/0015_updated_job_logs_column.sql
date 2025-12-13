-- Drop job_logs table
ALTER TABLE "gpr_job_logs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "gpr_job_logs" CASCADE;--> statement-breakpoint

-- Create a function to safely convert varchar to jsonb
CREATE OR REPLACE FUNCTION varchar_to_jsonb_safe(input_text text)
RETURNS jsonb AS $$
BEGIN
  IF input_text IS NULL OR input_text = '' THEN
    RETURN NULL;
  END IF;
  
  BEGIN
    -- Try to parse as JSON
    RETURN input_text::jsonb;
  EXCEPTION WHEN OTHERS THEN
    -- If parsing fails, return NULL (old string logs will be lost, but that's expected)
    RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;--> statement-breakpoint

-- Convert columns using the safe function
ALTER TABLE "gpr_jobs" ALTER COLUMN "code_generation_logs" SET DATA TYPE jsonb USING varchar_to_jsonb_safe(code_generation_logs);--> statement-breakpoint
ALTER TABLE "gpr_jobs" ALTER COLUMN "code_verification_logs" SET DATA TYPE jsonb USING varchar_to_jsonb_safe(code_verification_logs);--> statement-breakpoint
ALTER TABLE "gpr_jobs" ALTER COLUMN "code_generation_detail_logs" SET DATA TYPE jsonb USING varchar_to_jsonb_safe(code_generation_detail_logs);--> statement-breakpoint

-- Drop the temporary function
DROP FUNCTION varchar_to_jsonb_safe(text);
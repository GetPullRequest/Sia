-- Migration: Move repoId to repos array and remove repoId column
-- This migration converts the single repoId field to a repos array for multi-repo support

-- Step 1: Copy existing repoId values to repos array (as single-element array)
-- Only update rows where repoId is not null and repos is null/empty
UPDATE gpr_jobs
SET repos = ARRAY[repo_id]::text[]
WHERE repo_id IS NOT NULL
  AND (repos IS NULL OR array_length(repos, 1) IS NULL);

-- Step 2: Drop the repoId column (no longer needed)
ALTER TABLE gpr_jobs DROP COLUMN IF EXISTS repo_id;

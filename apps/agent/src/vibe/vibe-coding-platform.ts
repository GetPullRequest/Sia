import type { LogMessage } from '@sia/models';

export interface VibeCodingPlatform {
  executeJob(
    _jobId: string,
    _prompt: string,
    _repoId?: string,
    _jobDetails?: Record<string, string>
  ): AsyncGenerator<LogMessage>;
  hintJob(
    jobId: string,
    hint: string
  ): Promise<{ success: boolean; message: string }>;
  cancelJob(jobId: string): Promise<{ success: boolean; message: string }>;
  runVerification(
    jobId: string
  ): Promise<{ success: boolean; message: string; errors?: string[] }>;
  createPR(
    jobId: string,
    repoId: string,
    branchName: string,
    title: string,
    body: string
  ): Promise<{ success: boolean; prLink: string; message: string }>;
  cleanupWorkspace(
    jobId: string
  ): Promise<{ success: boolean; message: string }>;
}

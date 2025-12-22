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
  createPR(
    jobId: string,
    branchName: string,
    title: string,
    body: string,
    vibeCoderCredentials?: Record<string, string>,
    verificationErrors?: string[],
    repos?: Array<{ repoId: string; name: string; url: string }>,
    gitCredentials?: { token: string; username: string }
  ): Promise<{
    success: boolean;
    prLink: string;
    message: string;
    changesSummary?: string;
  }>;
  cleanupWorkspace(
    jobId: string
  ): Promise<{ success: boolean; message: string }>;
}

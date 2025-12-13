import {
  JobExecutor,
  type JobExecutionConfig,
} from '../executor/job-executor.js';
import type { LogMessage } from '@sia/models';
import type { VibeCodingPlatform } from './vibe-coding-platform.js';

export class JobVibePlatform implements VibeCodingPlatform {
  private executor: JobExecutor;
  private activeJobs: Map<
    string,
    { cancelled: boolean; hints: string[]; executor: JobExecutor }
  > = new Map();

  constructor(config?: JobExecutionConfig) {
    this.executor = new JobExecutor(config);
  }

  async *executeJob(
    jobId: string,
    prompt: string,
    repoId?: string,
    jobDetails?: Record<string, string>
  ): AsyncGenerator<LogMessage> {
    const jobState = {
      cancelled: false,
      hints: [] as string[],
      executor: this.executor,
    };
    this.activeJobs.set(jobId, jobState);

    try {
      // Apply any hints that were provided before execution started
      if (jobState.hints.length > 0) {
        const allHints = jobState.hints.join('\n');
        prompt = `${prompt}\n\nAdditional hints:\n${allHints}`;
      }

      const repos = repoId
        ? [{ repoId, name: repoId.split('/').pop() || repoId }]
        : undefined;

      const logStream = this.executor.executeJob(
        jobId,
        prompt,
        repos,
        jobDetails
      );

      for await (const logMessage of logStream) {
        if (jobState.cancelled) {
          yield {
            level: 'error',
            message: `Job ${jobId} was cancelled`,
            timestamp: new Date().toISOString(),
            jobId,
            stage: 'cancelled',
          };
          return;
        }

        yield logMessage;
      }
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  async hintJob(
    jobId: string,
    hint: string
  ): Promise<{ success: boolean; message: string }> {
    const jobState = this.activeJobs.get(jobId);
    if (!jobState) {
      return {
        success: false,
        message: `Job ${jobId} not found or not executing`,
      };
    }
    jobState.hints.push(hint);
    return { success: true, message: `Hint applied to job ${jobId}` };
  }

  async cancelJob(
    jobId: string
  ): Promise<{ success: boolean; message: string }> {
    const jobState = this.activeJobs.get(jobId);
    if (!jobState) {
      return {
        success: false,
        message: `Job ${jobId} not found or not executing`,
      };
    }
    jobState.cancelled = true;
    return { success: true, message: `Job ${jobId} cancelled` };
  }

  async runVerification(
    jobId: string
  ): Promise<{ success: boolean; message: string; errors?: string[] }> {
    try {
      // Get workspace path from executor
      const workspacePath = this.executor.getWorkspacePath(jobId);
      const { BuildService } = await import('../build/build-service.js');
      const buildService = new BuildService(workspacePath);

      // Run verification commands (build, test, lint, etc.)
      const buildCommands = ['npm install', 'npm run build', 'npm test'];
      const result = await buildService.executeBuild(buildCommands);

      return {
        success: result.success,
        message: result.success ? 'Verification passed' : 'Verification failed',
        errors: result.errors,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Verification failed',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  async createPR(
    jobId: string,
    repoId: string,
    branchName: string,
    title: string,
    body: string
  ): Promise<{ success: boolean; prLink: string; message: string }> {
    try {
      const workspacePath = this.executor.getWorkspacePath(jobId);
      const { GitService } = await import('../git/git-service.js');
      const gitService = new GitService(workspacePath);

      // Create PR using GitHub API
      const prLink = await gitService.createPullRequest(
        repoId,
        branchName,
        title,
        body
      );

      return {
        success: true,
        prLink,
        message: 'PR created successfully',
      };
    } catch (error) {
      return {
        success: false,
        prLink: '',
        message: error instanceof Error ? error.message : 'Failed to create PR',
      };
    }
  }

  async cleanupWorkspace(
    jobId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.executor.cleanupWorkspace(jobId);
      return {
        success: true,
        message: 'Workspace cleaned up successfully',
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to cleanup workspace',
      };
    }
  }
}

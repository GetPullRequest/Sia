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

      // Decode repos from jobDetails if available, otherwise use single repoId
      let repos;
      if (jobDetails?.reposJson) {
        try {
          repos = JSON.parse(jobDetails.reposJson);
        } catch (error) {
          console.error('Failed to parse reposJson:', error);
          // Fallback to single repo
          repos = repoId
            ? [{ repoId, name: repoId.split('/').pop() || repoId }]
            : undefined;
        }
      } else {
        // Legacy: single repoId
        repos = repoId
          ? [{ repoId, name: repoId.split('/').pop() || repoId }]
          : undefined;
      }

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

  async createPR(
    jobId: string,
    repoId: string,
    branchName: string,
    title: string,
    body: string,
    vibeCoderCredentials?: Record<string, string>,
    verificationErrors?: string[]
  ): Promise<{
    success: boolean;
    prLink: string;
    message: string;
    changesSummary?: string;
  }> {
    try {
      // Extract repo name from repoId to find the correct workspace
      const repoName = repoId.split('/').pop() || repoId;

      // Get the repo-specific worktree path
      const { WorkspaceManager } = await import(
        '../workspace/workspace-manager.js'
      );
      const workspaceManager = new WorkspaceManager();
      const repoPath = workspaceManager.getRepoWorktreePath(jobId, repoName);

      const { GitService } = await import('../git/git-service.js');
      const repoGitService = new GitService(repoPath);

      // Build prompt for vibe coder to generate commit message and PR body
      // Zero-shot prompting: let the vibe coder analyze the workspace and generate content
      const verificationErrorsText =
        verificationErrors && verificationErrors.length > 0
          ? `\n\n**Note:** Some verification steps failed:\n${verificationErrors
              .map(e => `- ${e}`)
              .join('\n')}`
          : '';

      const prompt = `Analyze the changes in this workspace and generate a commit message and PR description following Conventional Commits format.

${verificationErrorsText}

Provide your response as JSON:
\`\`\`json
{
  "commitMessage": "type: short description",
  "prTitle": "Short PR title",
  "prBody": "Detailed PR description with markdown formatting",
  "changesSummary": "Brief summary of all changes made (to be used for future revisions)"
}
\`\`\`

Only output the JSON, no other text.`;

      // Use vibe coder to generate PR content
      let generatedContent: {
        commitMessage?: string;
        prTitle?: string;
        prBody?: string;
        changesSummary?: string;
      } = {};

      try {
        const { CursorVibeCoder } = await import('./cursor-vibe-coder.js');
        const vibeCoder = new CursorVibeCoder(
          vibeCoderCredentials?.executablePath
        );
        const generator = vibeCoder.generateCode(
          repoPath,
          prompt,
          `${jobId}-pr-gen`,
          vibeCoderCredentials
        );

        let accumulatedResponse = '';
        for await (const log of generator) {
          // Accumulate assistant messages
          if (log.message) {
            accumulatedResponse += log.message + '\n';
          }
        }

        // Extract JSON from response
        const jsonMatch =
          accumulatedResponse.match(/```json\s*([\s\S]*?)\s*```/) ||
          accumulatedResponse.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          try {
            generatedContent = JSON.parse(jsonMatch[1] || jsonMatch[0]);
          } catch (parseError) {
            console.error('Failed to parse generated JSON:', parseError);
          }
        }
      } catch (vibeError) {
        console.error(
          'Failed to generate PR content with vibe coder:',
          vibeError
        );
        // Fallback to basic generation based on git status
      }

      // Fallback if vibe coder didn't generate content
      const commitMessage =
        generatedContent.commitMessage || `chore: update code for job ${jobId}`;
      const finalTitle = generatedContent.prTitle || title;
      let finalBody = generatedContent.prBody || body;

      // Add footer with job info and verification errors if any
      const footer = `\n\n---\n\n_This PR was automatically generated by Sia for job ${jobId}._`;
      if (verificationErrors && verificationErrors.length > 0) {
        finalBody += `\n\n**⚠️ Verification Errors:**\n${verificationErrors
          .map(e => `- ${e}`)
          .join('\n')}`;
      }
      finalBody += footer;

      // Stage and commit changes if not already committed
      // Check git status to see if there are uncommitted changes
      const repoStatus = await repoGitService.getStatus();

      if (
        repoStatus.staged.length === 0 &&
        (repoStatus.modified.length > 0 || repoStatus.created.length > 0)
      ) {
        for await (const _log of repoGitService.addAll(jobId)) {
          // Consume logs
        }
      }

      // Create commit if there are changes (re-check status after staging)
      const finalStatus = await repoGitService.getStatus();
      if (
        finalStatus.staged.length > 0 ||
        finalStatus.modified.length > 0 ||
        finalStatus.created.length > 0
      ) {
        for await (const _log of repoGitService.commit(commitMessage, jobId)) {
          // Consume logs
        }
      }

      // Extract git credentials from vibeCoderCredentials
      const gitCredentials =
        vibeCoderCredentials?.githubToken || vibeCoderCredentials?.github_token
          ? {
              token:
                vibeCoderCredentials.githubToken ||
                vibeCoderCredentials.github_token,
              username:
                vibeCoderCredentials.githubUsername ||
                vibeCoderCredentials.github_username,
            }
          : undefined;

      // Push branch if there are commits to push
      try {
        for await (const _log of repoGitService.push(
          branchName,
          gitCredentials,
          jobId
        )) {
          // Consume logs
        }
      } catch (pushError) {
        // If push fails, it might be because branch is already up to date or doesn't exist remotely
        // Continue with PR creation anyway
        console.warn(
          `Failed to push branch ${branchName}, continuing with PR creation:`,
          pushError
        );
      }

      // Create PR using GitHub API
      const prLink = await repoGitService.createPullRequest(
        repoId,
        branchName,
        finalTitle,
        finalBody,
        gitCredentials
      );

      return {
        success: true,
        prLink,
        message: 'PR created successfully',
        changesSummary:
          generatedContent.changesSummary || `Changes made for job ${jobId}`,
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

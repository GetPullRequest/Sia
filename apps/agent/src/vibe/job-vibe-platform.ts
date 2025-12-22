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
  }> {
    // Debug logging
    console.log(
      `[JobVibePlatform] createPR - jobId=${jobId}, repos: ${
        repos?.length || 0
      }, ` +
        `vibeCoderCredentials keys: ${
          vibeCoderCredentials
            ? Object.keys(vibeCoderCredentials).join(', ')
            : 'none'
        }, ` +
        `verificationErrors count: ${
          verificationErrors ? verificationErrors.length : 0
        }`
    );

    if (!repos || repos.length === 0) {
      throw new Error('No repositories provided for PR creation');
    }

    // Use first repo for PR creation
    const repo = repos[0];

    try {
      // Extract repo name from repo (prefer name, fallback to extracting from URL or repoId)
      let repoName = repo.name;
      if (!repoName || /^\d+$/.test(repoName)) {
        // Name is numeric or missing, extract from URL or repoId
        if (repo.url) {
          const urlMatch = repo.url.match(
            /github\.com[/:]([\w-]+)\/([\w-]+)(?:\.git)?/
          );
          if (urlMatch) {
            repoName = urlMatch[2]; // Use the repo name from URL
          }
        } else {
          repoName = repo.repoId.split('/').pop() || repo.repoId;
        }
      }

      // Get the repo-specific worktree path
      const { WorkspaceManager } = await import(
        '../workspace/workspace-manager.js'
      );
      const workspaceManager = new WorkspaceManager();
      const repoPath = workspaceManager.getRepoWorktreePath(jobId, repoName);

      const { GitService } = await import('../git/git-service.js');
      const repoGitService = new GitService(repoPath);

      // Build prompt for vibe coder to generate commit message and PR body
      // Ask agent to create a file instead of JSON output (more reliable for coding agents)
      const verificationErrorsText =
        verificationErrors && verificationErrors.length > 0
          ? `\n\nnote: some verification steps failed:\n${verificationErrors
              .map(e => `- ${e}`)
              .join('\n')}`
          : '';

      const siaDir = '.sia';
      const prInfoFileName = 'pr.json';
      const prompt = `Analyze the changes in this workspace and generate a commit message and PR description following Conventional Commits format.

${verificationErrorsText}

We store temporary metadata and any user-uploaded assets (including images) under the \`${siaDir}\` directory in this repo. You can reference any files under that directory from the PR body using relative paths.

Create or update a JSON file at \`${siaDir}/${prInfoFileName}\` with the following structure:

\`\`\`json
{
  "commitMessage": "type: short description",
  "prTitle": "Short PR title",
  "prBody": "Detailed PR description with markdown formatting.\\nThis can span multiple lines.",
  "changesSummary": "Brief summary of all changes made (to be used for future revisions).\\nThis can also span multiple lines."
}
\`\`\`

Only write valid JSON to this file. Do not include any backticks or markdown fences inside the file. Use \\n for line breaks in multi-line strings.`;

      // Use vibe coder to generate PR content
      const generatedContent: {
        commitMessage?: string;
        prTitle?: string;
        prBody?: string;
        changesSummary?: string;
      } = {};
      const prLogs: string[] = [];

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

        for await (const log of generator) {
          // Collect logs so they can be surfaced to the frontend
          prLogs.push(
            `[code-generation] ${log.level?.toUpperCase?.() || 'INFO'}: ${
              log.message || ''
            }`
          );
        }

        // Ensure .sia directory exists and read the generated JSON file
        const fs = await import('fs/promises');
        const path = await import('path');
        const siaPath = path.join(repoPath, siaDir);
        const prInfoPath = path.join(siaPath, prInfoFileName);

        try {
          await fs.mkdir(siaPath, { recursive: true });
          const fileContent = await fs.readFile(prInfoPath, 'utf-8');

          // Parse JSON file
          const parsed = JSON.parse(fileContent) as {
            commitMessage?: string;
            prTitle?: string;
            prBody?: string;
            changesSummary?: string;
          };

          if (parsed?.commitMessage) {
            generatedContent.commitMessage = parsed.commitMessage;
          }
          if (parsed?.prTitle) {
            generatedContent.prTitle = parsed.prTitle;
          }
          if (parsed?.prBody) {
            generatedContent.prBody = parsed.prBody;
          }
          if (parsed?.changesSummary) {
            generatedContent.changesSummary = parsed.changesSummary;
          }
        } catch (readError) {
          console.error(
            `Failed to read or parse ${prInfoFileName}:`,
            readError
          );
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
        for await (const log of repoGitService.addAll(jobId)) {
          prLogs.push(
            `[git:add] ${log.level?.toUpperCase?.() || 'INFO'}: ${
              log.message || ''
            }`
          );
        }

        // Unstage the .sia directory so temp metadata (including images) is not committed
        try {
          const { default: simpleGit } = await import('simple-git');
          const git = simpleGit(repoPath);
          await git.reset(['HEAD', siaDir]);
        } catch (resetError) {
          // .sia might not be staged, ignore error
          console.debug(`Could not unstage ${siaDir}:`, resetError);
        }
      }

      // Create commit if there are changes (re-check status after staging)
      const finalStatus = await repoGitService.getStatus();
      if (
        finalStatus.staged.length > 0 ||
        finalStatus.modified.length > 0 ||
        finalStatus.created.length > 0
      ) {
        for await (const log of repoGitService.commit(commitMessage, jobId)) {
          prLogs.push(
            `[git:commit] ${log.level?.toUpperCase?.() || 'INFO'}: ${
              log.message || ''
            }`
          );
        }
      }

      // Use git credentials from parameter (passed separately, not in vibeCoderCredentials)
      if (!gitCredentials) {
        throw new Error('Git credentials are required to create PR');
      }

      // Determine which branch to push: prefer the current branch in the worktree
      const statusForPush = await repoGitService.getStatus();
      const branchToPush = statusForPush.currentBranch || branchName;

      // Push branch if there are commits to push
      try {
        for await (const log of repoGitService.push(
          branchToPush,
          gitCredentials,
          jobId
        )) {
          prLogs.push(
            `[git:push] ${log.level?.toUpperCase?.() || 'INFO'}: ${
              log.message || ''
            }`
          );
        }
      } catch (pushError) {
        // If push fails, it might be because branch is already up to date or doesn't exist remotely
        // Continue with PR creation anyway
        console.warn(
          `Failed to push branch ${branchToPush}, continuing with PR creation:`,
          pushError
        );
      }

      // Determine the repo identifier for PR creation
      // Prefer URL format (owner/repo), fallback to repoId
      let repoIdentifier: string;
      if (repo.url) {
        // Extract owner/repo from URL
        const urlMatch = repo.url.match(
          /github\.com[/:]([\w-]+)\/([\w-]+)(?:\.git)?/
        );
        if (urlMatch) {
          repoIdentifier = `${urlMatch[1]}/${urlMatch[2]}`;
        } else {
          throw new Error(`Invalid GitHub URL format: ${repo.url}`);
        }
      } else if (repo.repoId.includes('/')) {
        // repoId is already in owner/repo format
        repoIdentifier = repo.repoId;
      } else {
        // repoId is numeric, we need URL to create PR
        throw new Error(
          `Cannot create PR: repoId "${repo.repoId}" is numeric and no URL provided. Please provide repo URL.`
        );
      }

      // Create PR using GitHub API
      const prLink = await repoGitService.createPullRequest(
        repoIdentifier,
        branchToPush,
        finalTitle,
        finalBody,
        gitCredentials
      );

      // Append automation logs to the PR body so the frontend can display them
      if (prLogs.length > 0) {
        finalBody += `\n\n<details>\n<summary>Automation logs</summary>\n\n${prLogs
          .map(line => `- ${line}`)
          .join('\n')}\n\n</details>`;
      }

      return {
        success: true,
        prLink,
        message: 'PR created successfully',
        changesSummary:
          generatedContent.changesSummary || `Changes made for job ${jobId}`,
      };
    } catch (error) {
      // Throw error instead of returning success: false to fail the workflow
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create PR';
      throw new Error(`PR creation failed: ${errorMessage}`);
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

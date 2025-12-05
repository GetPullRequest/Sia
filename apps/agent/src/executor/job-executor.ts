import { WorkspaceManager } from '../workspace/workspace-manager.js';
import { GitService, type GitCredentials } from '../git/git-service.js';
import type { VibeCoder } from '../vibe/vibe-coder-interface.js';
import { CursorVibeCoder } from '../vibe/cursor-vibe-coder.js';
import { BuildService } from '../build/build-service.js';
import { JobApiClient } from '../api/job-api-client.js';
import type { LogMessage } from '@sia/models';

export interface JobExecutionConfig {
  maxReworkAttempts?: number;
  buildCommands?: string[];
  commitMessage?: string;
  apiBaseUrl?: string;
  cursorExecutablePath?: string;
}

export class JobExecutor {
  private workspaceManager: WorkspaceManager;
  private jobApiClient: JobApiClient;
  private config: Omit<Required<JobExecutionConfig>, 'cursorExecutablePath'> & { cursorExecutablePath?: string };

  constructor(config: JobExecutionConfig = {}) {
    this.workspaceManager = new WorkspaceManager();
    this.jobApiClient = new JobApiClient(config.apiBaseUrl);
    this.config = {
      maxReworkAttempts: config.maxReworkAttempts || 3,
      buildCommands: config.buildCommands || ['npm install', 'npm run build'],
      commitMessage: config.commitMessage || 'Auto-generated code changes',
      apiBaseUrl: config.apiBaseUrl || 'http://localhost:3001',
      cursorExecutablePath: config.cursorExecutablePath,
    };
  }

  private extractGitCredentials(jobDetails?: Record<string, string>): GitCredentials | undefined {
    if (!jobDetails) return undefined;

    return {
      token: jobDetails.github_token || jobDetails.githubToken,
      username: jobDetails.github_username || jobDetails.githubUsername,
      password: jobDetails.github_password || jobDetails.githubPassword,
    };
  }

  private extractBranch(jobDetails?: Record<string, string>): string {
    return jobDetails?.branch || jobDetails?.git_branch || 'main';
  }

  private extractAttemptNumber(jobDetails?: Record<string, string>): number {
    const attempt = jobDetails?.attempt_number || jobDetails?.attemptNumber;
    return attempt ? parseInt(attempt, 10) : 1;
  }

  private extractBuildCommands(jobDetails?: Record<string, string>): string[] {
    const buildCommand = jobDetails?.build_command || jobDetails?.buildCommand;
    if (buildCommand) {
      // TODO: Parse build command - could be single command or comma-separated
      return buildCommand.split(',').map(cmd => cmd.trim());
    }
    return this.config.buildCommands;
  }

  private extractCommitMessage(jobDetails?: Record<string, string>): string {
    return jobDetails?.commit_message || jobDetails?.commitMessage || this.config.commitMessage;
  }

  private getVibeCoder(jobDetails?: Record<string, string>): VibeCoder {
    const vibeAgentType = jobDetails?.type || jobDetails?.vibeAgentType || 'cursor';
    const executablePath = jobDetails?.executablePath || jobDetails?.vibeAgentExecutablePath || this.config.cursorExecutablePath;

    switch (vibeAgentType) {
      case 'cursor':
        return new CursorVibeCoder(executablePath);
      case 'claude-code':
        // TODO: Implement ClaudeCodeVibeCoder
        throw new Error('Claude Code vibe-agent not yet implemented');
      case 'kiro-cli':
        // TODO: Implement KiroCliVibeCoder
        throw new Error('Kiro CLI vibe-agent not yet implemented');
      default:
        return new CursorVibeCoder(executablePath);
    }
  }

  getWorkspacePath(jobId: string, attemptNumber = 1): string {
    return this.workspaceManager.getWorkspacePath(jobId, attemptNumber);
  }

  async cleanupWorkspace(jobId: string, attemptNumber = 1): Promise<void> {
    await this.workspaceManager.cleanupWorkspace(jobId, attemptNumber);
  }

  async* executeJob(
    jobId: string,
    prompt: string,
    repoId?: string,
    jobDetails?: Record<string, string>
  ): AsyncGenerator<LogMessage> {
    const attemptNumber = this.extractAttemptNumber(jobDetails);
    let workspacePath: string | undefined;
    let buildSuccess = false;
    let reworkCount = 0;
    const maxReworkAttempts = this.config.maxReworkAttempts;

    try {
      // Stage 1: Create workspace
      const workspaceGen = this.workspaceManager.createWorkspaceWithLogs(jobId, attemptNumber);
      let workspacePathResult: string | undefined;
      for await (const log of workspaceGen) {
        if (typeof log === 'string') {
          workspacePathResult = log;
        } else {
          yield log;
        }
      }
      workspacePath = workspacePathResult || this.workspaceManager.getWorkspacePath(jobId, attemptNumber);

      if (!workspacePath) {
        throw new Error('Failed to create workspace');
      }

      // Stage 2: Clone repository (if repoId provided)
      if (repoId) {
        const gitService = new GitService(workspacePath);
        const credentials = this.extractGitCredentials(jobDetails);
        
        const cloneGen = gitService.cloneRepository(repoId, jobId, credentials);
        for await (const log of cloneGen) {
          yield log;
        }

        // Stage 3: Checkout branch
        const branch = this.extractBranch(jobDetails);
        const checkoutGen = gitService.checkoutBranch(branch, jobId);
        for await (const log of checkoutGen) {
          yield log;
        }
      }

      // Stage 4-6: Code Generation + Build (with retry loop)
      const buildCommands = this.extractBuildCommands(jobDetails);
      const buildService = new BuildService(workspacePath);
      const vibeCoder = this.getVibeCoder(jobDetails);

      do {
        // Stage 4: Invoke vibe coder
        const codeGen = vibeCoder.generateCode(workspacePath, prompt, jobId);
        for await (const log of codeGen) {
          yield log;
        }

        // Stage 5: Build the code
        try {
          const buildGen = buildService.build(buildCommands, jobId);
          for await (const log of buildGen) {
            yield log;
          }
          buildSuccess = true;
        } catch (buildError) {
          buildSuccess = false;
          
          // Stage 6: Request rework if build failed
          if (reworkCount < maxReworkAttempts) {
            yield {
              level: 'info',
              message: `Build failed. Requesting rework (attempt ${reworkCount + 1}/${maxReworkAttempts})`,
              timestamp: new Date().toISOString(),
              jobId,
              stage: 'rework',
            };

            // TODO: Implement rework logic
            // This might involve:
            // - Extracting build errors from the build output
            // - Sending errors back to vibe coder with context
            // - Modifying the prompt to include error information
            const buildResult = await buildService.executeBuild(buildCommands);
            const errorContext = buildResult.errors?.join('\n') || 'Build failed with unknown errors';
            
            // Update prompt with error context for rework
            prompt = `${prompt}\n\nBuild errors encountered:\n${errorContext}\n\nPlease fix these errors and regenerate the code.`;
            
            reworkCount++;
          } else {
            throw new Error(`Build failed after ${maxReworkAttempts} rework attempts`);
          }
        }
      } while (!buildSuccess && reworkCount < maxReworkAttempts);

      if (!buildSuccess) {
        throw new Error('Build failed after maximum rework attempts');
      }

      // Stage 7-13: Git Operations (only if repo was cloned)
      if (repoId) {
        const gitService = new GitService(workspacePath);

        // Stage 9: Add all changes
        const addGen = gitService.addAll(jobId);
        for await (const log of addGen) {
          yield log;
        }

        // Stage 10: Commit
        const commitMessage = this.extractCommitMessage(jobDetails);
        const commitGen = gitService.commit(commitMessage, jobId);
        for await (const log of commitGen) {
          yield log;
        }

        // Stage 12: Create new branch
        const branchName = jobId; // Using jobId as branch name
        const branchGen = gitService.createBranch(branchName, jobId);
        for await (const log of branchGen) {
          yield log;
        }

        // Stage 13: Push
        const credentials = this.extractGitCredentials(jobDetails);
        const pushGen = gitService.push(branchName, credentials, jobId);
        for await (const log of pushGen) {
          yield log;
        }

        // PR will be created later via Temporal workflow signal
      }

      // Stage 14: Update job status
      const prLink = repoId ? `https://github.com/${repoId}/compare/${jobId}` : undefined;
      const updateGen = this.jobApiClient.updateJob(jobId, {
        status: 'completed',
        prLink,
        updatedBy: 'agent',
      });
      for await (const log of updateGen) {
        yield log;
      }

      yield {
        level: 'success',
        message: `Job ${jobId} completed successfully`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'completed',
      };
    } catch (error) {
      yield {
        level: 'error',
        message: `Job execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'error',
      };

      // Update job status to failed
      try {
        const updateGen = this.jobApiClient.updateJob(jobId, {
          status: 'failed',
          updatedBy: 'agent',
        });
        for await (const log of updateGen) {
          yield log;
        }
      } catch (updateError) {
        yield {
          level: 'error',
          message: `Failed to update job status: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'error',
        };
      }

      // TODO: Optionally cleanup workspace on failure
      // if (workspacePath) {
      //   await this.workspaceManager.cleanupWorkspace(jobId, attemptNumber);
      // }
    }
  }
}


import { WorkspaceManager } from '../workspace/workspace-manager.js';
import { GitService, type GitCredentials } from '../git/git-service.js';
import type { VibeCoder } from '../vibe/vibe-coder-interface.js';
import { CursorVibeCoder } from '../vibe/cursor-vibe-coder.js';
import { BuildService } from '../build/build-service.js';
import { JobApiClient } from '../api/job-api-client.js';
import { ContainerManager } from '../container/container-manager.js';
import { CleanupService } from '../cleanup/cleanup-service.js';
import type { LogMessage } from '@sia/models';

export interface RepoConfig {
  repoId: string; // "org/frontend"
  name: string; // "frontend" (folder name)
  branch?: string; // default: "main"
}

export interface JobExecutionConfig {
  maxReworkAttempts?: number;
  buildCommands?: string[];
  commitMessage?: string;
  apiBaseUrl?: string;
  cursorExecutablePath?: string;
  containerImage?: string;
}

export class JobExecutor {
  private workspaceManager: WorkspaceManager;
  private jobApiClient: JobApiClient;
  private containerManager: ContainerManager;
  private cleanupService: CleanupService;
  private config: Omit<Required<JobExecutionConfig>, 'cursorExecutablePath'> & {
    cursorExecutablePath?: string;
  };

  constructor(config: JobExecutionConfig = {}) {
    this.workspaceManager = new WorkspaceManager();
    this.jobApiClient = new JobApiClient(config.apiBaseUrl);
    this.containerManager = new ContainerManager({
      image: config.containerImage,
    });
    this.cleanupService = new CleanupService(this.containerManager);
    this.config = {
      maxReworkAttempts: config.maxReworkAttempts || 3,
      buildCommands: config.buildCommands || ['npm install', 'npm run build'],
      commitMessage: config.commitMessage || 'Auto-generated code changes',
      apiBaseUrl: config.apiBaseUrl || 'http://localhost:3001',
      cursorExecutablePath: config.cursorExecutablePath,
      containerImage: config.containerImage || 'sia-dev-env:latest',
    };
  }

  /**
   * Ensure container is running before executing jobs
   */
  async ensureReady(): Promise<void> {
    await this.containerManager.ensureContainerRunning();
  }

  /**
   * Stop the container (for agent shutdown)
   */
  async shutdown(): Promise<void> {
    await this.containerManager.stopContainer();
  }

  private extractGitCredentials(
    jobDetails?: Record<string, string>
  ): GitCredentials | undefined {
    if (!jobDetails) return undefined;

    return {
      token: jobDetails.github_token || jobDetails.githubToken,
      username: jobDetails.github_username || jobDetails.githubUsername,
      password: jobDetails.github_password || jobDetails.githubPassword,
    };
  }

  private extractBuildCommands(jobDetails?: Record<string, string>): string[] {
    const buildCommand = jobDetails?.build_command || jobDetails?.buildCommand;
    if (buildCommand) {
      return buildCommand.split(',').map(cmd => cmd.trim());
    }
    return this.config.buildCommands;
  }

  private extractCommitMessage(jobDetails?: Record<string, string>): string {
    return (
      jobDetails?.commit_message ||
      jobDetails?.commitMessage ||
      this.config.commitMessage
    );
  }

  private getVibeCoder(jobDetails?: Record<string, string>): VibeCoder {
    const vibeAgentType =
      jobDetails?.type || jobDetails?.vibeAgentType || 'cursor';
    const executablePath =
      jobDetails?.executablePath ||
      jobDetails?.vibeAgentExecutablePath ||
      this.config.cursorExecutablePath;

    switch (vibeAgentType) {
      case 'cursor':
        return new CursorVibeCoder(executablePath);
      case 'claude-code':
        throw new Error('Claude Code vibe-agent not yet implemented');
      case 'kiro-cli':
        throw new Error('Kiro CLI vibe-agent not yet implemented');
      default:
        return new CursorVibeCoder(executablePath);
    }
  }

  getWorkspacePath(jobId: string): string {
    return this.workspaceManager.getJobWorkspace(jobId);
  }

  async cleanupWorkspace(jobId: string): Promise<void> {
    const jobWorkspace = this.workspaceManager.getJobWorkspace(jobId);
    for await (const _log of this.cleanupService.cleanupBetweenJobs(
      jobId,
      jobWorkspace
    )) {
      // Consume logs
    }
  }

  /**
   * Execute a job with multi-repo support
   */
  async *executeJob(
    jobId: string,
    prompt: string,
    repos?: RepoConfig[],
    jobDetails?: Record<string, string>
  ): AsyncGenerator<LogMessage> {
    let buildSuccess = false;
    let reworkCount = 0;
    const maxReworkAttempts = this.config.maxReworkAttempts;

    try {
      // Ensure container is running
      yield {
        level: 'info',
        message: 'Ensuring container is ready',
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'setup',
      };
      await this.containerManager.ensureContainerRunning();

      // Stage 1: Setup workspace structure
      yield {
        level: 'info',
        message: `Setting up workspace for job ${jobId}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'setup',
      };

      const jobWorkspace = this.workspaceManager.getJobWorkspace(jobId);

      // Create job workspace directory in container
      await this.containerManager.execInContainer(
        `mkdir -p ${jobWorkspace}`,
        '/workspace'
      );

      // Stage 2: Clone bare repos and create worktrees (if repos provided)
      if (repos && repos.length > 0) {
        const credentials = this.extractGitCredentials(jobDetails);
        const gitService = new GitService('/workspace', this.containerManager);

        for (const repo of repos) {
          const bareRepoPath = this.workspaceManager.getBareRepoPath(
            repo.repoId
          );
          const worktreePath = this.workspaceManager.getRepoWorktreePath(
            jobId,
            repo.name
          );
          const branch = repo.branch || 'main';

          // Clone bare repo (or fetch if exists)
          yield {
            level: 'info',
            message: `Setting up repository: ${repo.repoId}`,
            timestamp: new Date().toISOString(),
            jobId,
            stage: 'clone',
          };

          for await (const log of gitService.cloneBareRepository(
            repo.repoId,
            bareRepoPath,
            credentials,
            jobId
          )) {
            yield log;
          }

          // Create worktree for this job
          for await (const log of gitService.createWorktree(
            bareRepoPath,
            worktreePath,
            `${jobId}-${repo.name}`,
            jobId
          )) {
            yield log;
          }

          // Checkout base branch
          yield {
            level: 'info',
            message: `Checking out branch ${branch} in ${repo.name}`,
            timestamp: new Date().toISOString(),
            jobId,
            stage: 'checkout',
          };
        }
      }

      // Stage 3-6: Code Generation + Build (with retry loop)
      const buildCommands = this.extractBuildCommands(jobDetails);
      const vibeCoder = this.getVibeCoder(jobDetails);

      do {
        // Stage 3: Invoke vibe coder on job workspace
        yield {
          level: 'info',
          message: `Starting code generation in ${jobWorkspace}`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'code-generation',
        };

        // TODO: Update vibe coder to work with container
        // For now, this will need to be adapted
        const codeGen = vibeCoder.generateCode(jobWorkspace, prompt, jobId);
        for await (const log of codeGen) {
          yield log;
        }

        // Stage 4: Build all repos
        if (repos && repos.length > 0) {
          for (const repo of repos) {
            const repoPath = this.workspaceManager.getRepoWorktreePath(
              jobId,
              repo.name
            );

            yield {
              level: 'info',
              message: `Building ${repo.name} at ${repoPath}`,
              timestamp: new Date().toISOString(),
              jobId,
              stage: 'build',
            };

            try {
              // Build service needs to work in container
              const buildService = new BuildService(repoPath);
              const buildGen = buildService.build(buildCommands, jobId);
              for await (const log of buildGen) {
                yield log;
              }
            } catch (buildError) {
              buildSuccess = false;

              // Stage 5: Request rework if build failed
              if (reworkCount < maxReworkAttempts) {
                yield {
                  level: 'info',
                  message: `Build failed for ${
                    repo.name
                  }. Requesting rework (attempt ${
                    reworkCount + 1
                  }/${maxReworkAttempts})`,
                  timestamp: new Date().toISOString(),
                  jobId,
                  stage: 'rework',
                };

                const buildService = new BuildService(repoPath);
                const buildResult = await buildService.executeBuild(
                  buildCommands
                );
                const errorContext =
                  buildResult.errors?.join('\n') ||
                  'Build failed with unknown errors';

                prompt = `${prompt}\n\nBuild errors in ${repo.name}:\n${errorContext}\n\nPlease fix these errors and regenerate the code.`;

                reworkCount++;
                break; // Break repo loop to retry generation
              } else {
                throw new Error(
                  `Build failed for ${repo.name} after ${maxReworkAttempts} rework attempts`
                );
              }
            }
          }

          buildSuccess = true;
        } else {
          // No repos, just mark as successful
          buildSuccess = true;
        }
      } while (!buildSuccess && reworkCount < maxReworkAttempts);

      if (!buildSuccess) {
        throw new Error('Build failed after maximum rework attempts');
      }

      // Stage 6-10: Git Operations (only if repos exist)
      if (repos && repos.length > 0) {
        const credentials = this.extractGitCredentials(jobDetails);
        const commitMessage = this.extractCommitMessage(jobDetails);

        for (const repo of repos) {
          const repoPath = this.workspaceManager.getRepoWorktreePath(
            jobId,
            repo.name
          );
          const gitService = new GitService(repoPath, this.containerManager);

          yield {
            level: 'info',
            message: `Committing changes for ${repo.name}`,
            timestamp: new Date().toISOString(),
            jobId,
            stage: 'git',
          };

          // Add all changes
          for await (const log of gitService.addAll(jobId)) {
            yield log;
          }

          // Commit
          for await (const log of gitService.commit(commitMessage, jobId)) {
            yield log;
          }

          // Push
          const branchName = `${jobId}-${repo.name}`;
          for await (const log of gitService.push(
            branchName,
            credentials,
            jobId
          )) {
            yield log;
          }

          yield {
            level: 'success',
            message: `Successfully pushed changes for ${repo.name}`,
            timestamp: new Date().toISOString(),
            jobId,
            stage: 'git',
          };
        }
      }

      // Stage 11: Update job status
      const prLinks = repos?.map(
        repo =>
          `https://github.com/${repo.repoId}/compare/${jobId}-${repo.name}`
      );

      const updateGen = this.jobApiClient.updateJob(jobId, {
        status: 'completed',
        prLink: prLinks?.[0],
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

      // Stage 12: Cleanup worktrees
      if (repos && repos.length > 0) {
        yield {
          level: 'info',
          message: 'Cleaning up worktrees',
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'cleanup',
        };

        const gitService = new GitService('/workspace', this.containerManager);
        for (const repo of repos) {
          const bareRepoPath = this.workspaceManager.getBareRepoPath(
            repo.repoId
          );
          const worktreePath = this.workspaceManager.getRepoWorktreePath(
            jobId,
            repo.name
          );

          for await (const log of gitService.removeWorktree(
            bareRepoPath,
            worktreePath,
            jobId
          )) {
            yield log;
          }
        }
      }

      // Full cleanup between jobs
      for await (const log of this.cleanupService.cleanupBetweenJobs(
        jobId,
        jobWorkspace
      )) {
        yield log;
      }
    } catch (error) {
      yield {
        level: 'error',
        message: `Job execution failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
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
          message: `Failed to update job status: ${
            updateError instanceof Error ? updateError.message : 'Unknown error'
          }`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'error',
        };
      }

      // Attempt cleanup even on failure
      try {
        const jobWorkspace = this.workspaceManager.getJobWorkspace(jobId);
        for await (const log of this.cleanupService.cleanupBetweenJobs(
          jobId,
          jobWorkspace
        )) {
          yield log;
        }
      } catch {
        // Ignore cleanup errors
      }

      throw error;
    }
  }
}

import { WorkspaceManager } from '../workspace/workspace-manager.js';
import { GitService, type GitCredentials } from '../git/git-service.js';
import type { VibeCoder } from '../vibe/vibe-coder-interface.js';
import { CursorVibeCoder } from '../vibe/cursor-vibe-coder.js';
import { BuildService } from '../build/build-service.js';
import { ContainerManager } from '../container/container-manager.js';
import { CleanupService } from '../cleanup/cleanup-service.js';
import type { LogMessage } from '@sia/models';
import fs from 'fs/promises';

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
  private containerManager: ContainerManager;
  private cleanupService: CleanupService;
  private config: Omit<Required<JobExecutionConfig>, 'cursorExecutablePath'> & {
    cursorExecutablePath?: string;
  };

  constructor(config: JobExecutionConfig = {}) {
    this.workspaceManager = new WorkspaceManager();
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
   * Execute a job step (checkout, setup, build, execute, validate)
   */
  async *executeJob(
    jobId: string,
    prompt: string,
    repos?: RepoConfig[],
    jobDetails?: Record<string, string>
  ): AsyncGenerator<LogMessage> {
    const step =
      (jobDetails?.step as
        | 'checkout'
        | 'setup'
        | 'build'
        | 'execute'
        | 'validate') || 'execute';

    const stepLogs = this.executeStep(jobId, prompt, repos, jobDetails, step);
    for await (const log of stepLogs) {
      yield log;
    }
  }

  /**
   * Execute a single step of the pipeline (checkout, setup, build, execute, validate)
   */
  private async *executeStep(
    jobId: string,
    prompt: string,
    repos: RepoConfig[] | undefined,
    jobDetails: Record<string, string> | undefined,
    step: 'checkout' | 'setup' | 'build' | 'execute' | 'validate'
  ): AsyncGenerator<LogMessage> {
    // Start step
    yield {
      level: 'info',
      message: `Starting '${step}' step for job ${jobId}`,
      timestamp: new Date().toISOString(),
      jobId,
      stage: step,
    };

    const jobWorkspace = this.workspaceManager.getJobWorkspace(jobId);
    const bareReposPath = this.workspaceManager.getBareReposPath();
    const jobsPath = this.workspaceManager.getJobsPath();

    // Ensure local directories exist (no container dependency for step mode)
    await fs.mkdir(bareReposPath, { recursive: true });
    await fs.mkdir(jobsPath, { recursive: true });
    await fs.mkdir(jobWorkspace, { recursive: true });

    // Checkout step: materialize git worktrees for all repos
    if (step === 'checkout' && repos && repos.length > 0) {
      const credentials = this.extractGitCredentials(jobDetails);
      // For step-based flow, run git commands directly on host (no container)
      const gitService = new GitService(this.workspaceManager.getBasePath());

      for (const repo of repos) {
        const bareRepoPath = this.workspaceManager.getBareRepoPath(repo.repoId);
        const worktreePath = this.workspaceManager.getRepoWorktreePath(
          jobId,
          repo.name
        );
        const branch = repo.branch || 'main';

        // Clone bare repo (or fetch if exists)
        yield {
          level: 'info',
          message: `Ensuring repository is available: ${repo.repoId}`,
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

      yield {
        level: 'success',
        message: `Checkout step completed for job ${jobId}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'checkout',
      };
      return;
    }

    if (step === 'execute') {
      const vibeCoder = this.getVibeCoder(jobDetails);

      yield {
        level: 'info',
        message: `Starting code generation (execute step) in ${jobWorkspace}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'code-generation',
      };

      const codeGen = vibeCoder.generateCode(jobWorkspace, prompt, jobId);
      for await (const log of codeGen) {
        yield log;
      }

      yield {
        level: 'success',
        message: `Execute step completed for job ${jobId}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'code-generation',
      };

      return;
    }

    // For setup/build/validate steps, run commands inside each repo worktree
    const commandKey =
      step === 'setup'
        ? 'setupCommands'
        : step === 'build'
        ? 'buildCommands'
        : 'testCommands';
    const rawCommands = jobDetails?.[commandKey] || '';
    const commands =
      rawCommands
        .split(';')
        .map(cmd => cmd.trim())
        .filter(Boolean) || (step === 'build' ? this.config.buildCommands : []);

    if (!commands.length) {
      yield {
        level: 'info',
        message: `No ${step} commands configured for job ${jobId} - skipping`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: step,
      };
      return;
    }

    if (!repos || repos.length === 0) {
      yield {
        level: 'info',
        message: `No repositories provided for ${step} step - nothing to do`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: step,
      };
      return;
    }

    for (const repo of repos) {
      const repoPath = this.workspaceManager.getRepoWorktreePath(
        jobId,
        repo.name
      );
      const buildService = new BuildService(repoPath);

      yield {
        level: 'info',
        message: `Running ${step} commands in ${repo.name} at ${repoPath}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: step,
      };

      try {
        const gen = buildService.build(commands, jobId);
        for await (const log of gen) {
          yield log;
        }
      } catch (error) {
        yield {
          level: 'error',
          message: `${step} step failed for ${repo.name}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: step,
        };
        throw error;
      }
    }

    yield {
      level: 'success',
      message: `${step} step completed for job ${jobId}`,
      timestamp: new Date().toISOString(),
      jobId,
      stage: step,
    };
  }
}

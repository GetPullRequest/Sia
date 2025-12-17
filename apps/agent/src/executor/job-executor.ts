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
  repoId: string; // "org/frontend" or numeric ID
  name: string; // "frontend" (folder name)
  url?: string; // Full repository URL (e.g., "https://github.com/owner/repo.git")
  branch?: string; // default: "main"
  setupCommands?: string[];
  buildCommands?: string[];
  testCommands?: string[];
  isConfirmed?: boolean;
  detectedFrom?: string;
}

export interface JobExecutionConfig {
  maxReworkAttempts?: number;
  buildCommands?: string[];
  commitMessage?: string;
  apiBaseUrl?: string;
  cursorExecutablePath?: string;
  containerImage?: string;
  workspacePath?: string; // Base path for workspace (defaults to ~/.sia/workspace for local, /workspace for container)
}

export class JobExecutor {
  private workspaceManager: WorkspaceManager;
  private containerManager: ContainerManager;
  private cleanupService: CleanupService;
  private config: Omit<
    Required<JobExecutionConfig>,
    'cursorExecutablePath' | 'workspacePath'
  > & {
    cursorExecutablePath?: string;
    workspacePath?: string;
  };

  constructor(config: JobExecutionConfig = {}) {
    this.workspaceManager = new WorkspaceManager(config.workspacePath);
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
      workspacePath: config.workspacePath,
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
        // Use URL if available, otherwise fall back to repoId
        const repoUrlOrId = repo.url || repo.repoId;

        // Extract repo identifier for path generation (prefer owner/repo format)
        let repoIdentifier = repo.repoId;
        if (repo.url) {
          // Extract owner/repo from URL (e.g., https://github.com/owner/repo.git -> owner/repo)
          const urlMatch = repo.url.match(
            /github\.com[/:]([\w-]+)\/([\w-]+)(?:\.git)?/
          );
          if (urlMatch) {
            repoIdentifier = `${urlMatch[1]}/${urlMatch[2]}`;
          }
        }

        // Use repo.name for worktree path, but ensure it's not a numeric ID
        // If name looks like a numeric ID, extract name from URL
        let repoName = repo.name;
        if (repo.url && /^\d+$/.test(repoName)) {
          // Name is numeric, extract from URL instead
          const urlMatch = repo.url.match(
            /github\.com[/:]([\w-]+)\/([\w-]+)(?:\.git)?/
          );
          if (urlMatch) {
            repoName = urlMatch[2]; // Use the repo name from URL
          }
        }

        const bareRepoPath =
          this.workspaceManager.getBareRepoPath(repoIdentifier);
        const worktreePath = this.workspaceManager.getRepoWorktreePath(
          jobId,
          repoName
        );
        const baseBranch = repo.branch || 'main';

        // Clone bare repo (or fetch if exists)
        yield {
          level: 'info',
          message: `Ensuring repository is available: ${repoName} (${repoUrlOrId})`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'clone',
        };

        for await (const log of gitService.cloneBareRepository(
          repoUrlOrId,
          bareRepoPath,
          credentials,
          jobId
        )) {
          yield log;
        }

        // Create worktree from base branch (checkout existing branch)
        yield {
          level: 'info',
          message: `Creating worktree for ${repoName} from branch ${baseBranch}`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'checkout',
        };

        for await (const log of gitService.createWorktreeFromBranch(
          bareRepoPath,
          worktreePath,
          baseBranch,
          jobId
        )) {
          yield log;
        }

        yield {
          level: 'success',
          message: `Successfully checked out ${repoName} on branch ${baseBranch}`,
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
      const gitService = new GitService(this.workspaceManager.getBasePath());

      // Create new branch for changes in each repo worktree
      if (repos && repos.length > 0) {
        for (const repo of repos) {
          // Extract proper repo name (same logic as checkout step)
          let repoName = repo.name;
          if (repo.url && /^\d+$/.test(repoName)) {
            const urlMatch = repo.url.match(
              /github\.com[/:]([\w-]+)\/([\w-]+)(?:\.git)?/
            );
            if (urlMatch) {
              repoName = urlMatch[2];
            }
          }

          const worktreePath = this.workspaceManager.getRepoWorktreePath(
            jobId,
            repoName
          );
          const newBranchName = `sia-${jobId}-${repoName}`;

          yield {
            level: 'info',
            message: `Creating branch ${newBranchName} in ${repoName}`,
            timestamp: new Date().toISOString(),
            jobId,
            stage: 'git',
          };

          for await (const log of gitService.createBranchInWorktree(
            worktreePath,
            newBranchName,
            jobId
          )) {
            yield log;
          }
        }
      }

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
      // Extract proper repo name (same logic as checkout step)
      let repoName = repo.name;
      if (repo.url && /^\d+$/.test(repoName)) {
        const urlMatch = repo.url.match(
          /github\.com[/:]([\w-]+)\/([\w-]+)(?:\.git)?/
        );
        if (urlMatch) {
          repoName = urlMatch[2];
        }
      }

      const repoPath = this.workspaceManager.getRepoWorktreePath(
        jobId,
        repoName
      );
      const buildService = new BuildService(repoPath);

      yield {
        level: 'info',
        message: `Running ${step} commands in ${repoName} at ${repoPath}`,
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
          message: `${step} step failed for ${repoName}: ${
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

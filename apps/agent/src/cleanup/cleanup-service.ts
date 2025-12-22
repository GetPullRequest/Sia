import type { ContainerManager } from '../container/container-manager.js';
import type { LogMessage } from '@sia/models';
import { GitService } from '../git/git-service.js';
import { WorkspaceManager } from '../workspace/workspace-manager.js';

export class CleanupService {
  private containerManager: ContainerManager;
  private workspaceManager: WorkspaceManager;
  private gitService: GitService;

  constructor(containerManager: ContainerManager) {
    this.containerManager = containerManager;
    this.workspaceManager = new WorkspaceManager();
    this.gitService = new GitService(
      this.workspaceManager.getBasePath(),
      containerManager
    );
  }

  /**
   * Kill all processes in the container except essential system processes
   * This helps prevent process leakage between jobs
   */
  async *killProcesses(jobId?: string): AsyncGenerator<LogMessage> {
    try {
      yield {
        level: 'info',
        message: 'Killing all job-related processes',
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'cleanup',
      };

      // Kill common dev server processes
      const processesToKill = [
        'node',
        'npm',
        'yarn',
        'pnpm',
        'python',
        'python3',
        'cursor-agent',
        'code',
      ];

      for (const proc of processesToKill) {
        try {
          await this.containerManager.execInContainer(
            `pkill -9 ${proc} || true`, // || true to ignore if no process found
            '/workspace'
          );
        } catch {
          // Ignore errors - process might not exist
        }
      }

      yield {
        level: 'info',
        message: 'Successfully killed all job-related processes',
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'cleanup',
      };
    } catch (error) {
      yield {
        level: 'error',
        message: `Failed to kill processes: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'cleanup',
      };
      // Don't throw - cleanup is best effort
    }
  }

  /**
   * Clear temporary files and caches
   */
  async *clearTempFiles(jobId?: string): AsyncGenerator<LogMessage> {
    try {
      yield {
        level: 'info',
        message: 'Clearing temporary files and caches',
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'cleanup',
      };

      // Clear common temp directories
      const dirsToClean = [
        '/tmp/*',
        '/workspace/.npm/_cacache',
        '/workspace/.cache',
      ];

      for (const dir of dirsToClean) {
        try {
          await this.containerManager.execInContainer(
            `rm -rf ${dir} || true`,
            '/workspace'
          );
        } catch {
          // Ignore errors
        }
      }

      yield {
        level: 'info',
        message: 'Successfully cleared temporary files',
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'cleanup',
      };
    } catch (error) {
      yield {
        level: 'error',
        message: `Failed to clear temp files: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'cleanup',
      };
      // Don't throw - cleanup is best effort
    }
  }

  /**
   * Reset environment variables
   * Clear any environment variables that might have been set by previous jobs
   */
  async *resetEnvironment(jobId?: string): AsyncGenerator<LogMessage> {
    try {
      yield {
        level: 'info',
        message: 'Resetting environment variables',
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'cleanup',
      };

      // Unset common environment variables
      const envsToUnset = [
        'DATABASE_URL',
        'API_KEY',
        'SECRET_KEY',
        'NODE_ENV',
        'PORT',
      ];

      const unsetCommands = envsToUnset.map(env => `unset ${env}`).join(' && ');
      await this.containerManager.execInContainer(unsetCommands, '/workspace');

      yield {
        level: 'info',
        message: 'Successfully reset environment variables',
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'cleanup',
      };
    } catch (error) {
      yield {
        level: 'error',
        message: `Failed to reset environment: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'cleanup',
      };
      // Don't throw - cleanup is best effort
    }
  }

  /**
   * Find the bare repo path for a worktree by reading its .git file
   */
  private async findBareRepoForWorktree(
    worktreePath: string
  ): Promise<string | null> {
    try {
      // Read the .git file in the worktree (it contains the path to the bare repo)
      const gitFilePath = `${worktreePath}/.git`;
      const result = await this.containerManager.execInContainer(
        `cat "${gitFilePath}" 2>/dev/null || echo ""`,
        '/workspace'
      );

      if (result.exitCode !== 0 || !result.stdout.trim()) {
        return null;
      }

      // The .git file contains: gitdir: /path/to/bare-repo.git/worktrees/worktree-name
      const gitDirLine = result.stdout.trim().split('\n')[0];
      if (gitDirLine.startsWith('gitdir: ')) {
        const worktreeGitDir = gitDirLine.substring('gitdir: '.length).trim();
        // Extract bare repo path: /path/to/bare-repo.git/worktrees/... -> /path/to/bare-repo.git
        const bareRepoMatch = worktreeGitDir.match(/^(.+\.git)\/worktrees\//);
        if (bareRepoMatch) {
          return bareRepoMatch[1];
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Remove all worktrees in a job workspace before deleting the directory
   */
  async *removeWorktreesInJob(
    jobWorkspacePath: string,
    jobId?: string
  ): AsyncGenerator<LogMessage> {
    try {
      // List all directories in the job workspace (each is a worktree)
      const result = await this.containerManager.execInContainer(
        `ls -d ${jobWorkspacePath}/*/ 2>/dev/null || echo ""`,
        '/workspace'
      );

      if (result.exitCode !== 0 || !result.stdout.trim()) {
        // No worktrees found or directory doesn't exist
        return;
      }

      const worktreePaths = result.stdout
        .trim()
        .split('\n')
        .filter(path => path.trim())
        .map(path => path.trim().replace(/\/$/, '')); // Remove trailing slash

      for (const worktreePath of worktreePaths) {
        try {
          // Check if this is a worktree by looking for .git file
          const gitFileCheck = await this.containerManager.execInContainer(
            `test -f "${worktreePath}/.git" && echo "yes" || echo "no"`,
            '/workspace'
          );

          if (gitFileCheck.stdout.trim() !== 'yes') {
            // Not a worktree, skip
            continue;
          }

          // Find the bare repo for this worktree
          const bareRepoPath = await this.findBareRepoForWorktree(worktreePath);

          if (bareRepoPath) {
            yield {
              level: 'info',
              message: `Removing worktree at ${worktreePath} from bare repo ${bareRepoPath}`,
              timestamp: new Date().toISOString(),
              jobId: jobId || 'unknown',
              stage: 'cleanup',
            };

            // Use GitService to properly remove the worktree
            for await (const log of this.gitService.removeWorktree(
              bareRepoPath,
              worktreePath,
              jobId
            )) {
              yield log;
            }
          } else {
            // Couldn't find bare repo, but still try to remove worktree using git command
            yield {
              level: 'warn',
              message: `Could not determine bare repo for worktree ${worktreePath}, attempting direct removal`,
              timestamp: new Date().toISOString(),
              jobId: jobId || 'unknown',
              stage: 'cleanup',
            };

            // Try to find bare repo by checking all bare repos
            const bareReposPath = this.workspaceManager.getBareReposPath();
            const bareReposResult = await this.containerManager.execInContainer(
              `ls -d ${bareReposPath}/*.git/ 2>/dev/null || echo ""`,
              '/workspace'
            );

            if (
              bareReposResult.exitCode === 0 &&
              bareReposResult.stdout.trim()
            ) {
              const bareRepos = bareReposResult.stdout
                .trim()
                .split('\n')
                .map(path => path.trim().replace(/\/$/, ''));

              // Check each bare repo to see if it has this worktree
              for (const bareRepo of bareRepos) {
                try {
                  const worktreeList =
                    await this.containerManager.execInContainer(
                      `git -C "${bareRepo}" worktree list --porcelain | grep -A1 "worktree ${worktreePath}" || echo ""`,
                      '/workspace'
                    );

                  if (worktreeList.stdout.trim()) {
                    // Found the bare repo, remove the worktree
                    for await (const log of this.gitService.removeWorktree(
                      bareRepo,
                      worktreePath,
                      jobId
                    )) {
                      yield log;
                    }
                    break;
                  }
                } catch {
                  // Continue to next bare repo
                }
              }
            }
          }
        } catch (error) {
          yield {
            level: 'warn',
            message: `Failed to remove worktree at ${worktreePath}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }. Will attempt to remove directory anyway.`,
            timestamp: new Date().toISOString(),
            jobId: jobId || 'unknown',
            stage: 'cleanup',
          };
          // Continue with other worktrees
        }
      }
    } catch (error) {
      yield {
        level: 'warn',
        message: `Failed to list worktrees in job workspace: ${
          error instanceof Error ? error.message : 'Unknown error'
        }. Will attempt to remove directory anyway.`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'cleanup',
      };
      // Don't throw - continue with directory removal
    }
  }

  /**
   * Remove job workspace directory
   * First removes all worktrees properly, then deletes the directory
   */
  async *removeJobWorkspace(
    jobWorkspacePath: string,
    jobId?: string
  ): AsyncGenerator<LogMessage> {
    try {
      yield {
        level: 'info',
        message: `Removing job workspace at ${jobWorkspacePath}`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'cleanup',
      };

      // First, properly remove all worktrees
      for await (const log of this.removeWorktreesInJob(
        jobWorkspacePath,
        jobId
      )) {
        yield log;
      }

      // Then remove the job workspace directory
      await this.containerManager.execInContainer(
        `rm -rf ${jobWorkspacePath}`,
        '/workspace'
      );

      yield {
        level: 'info',
        message: `Successfully removed job workspace`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'cleanup',
      };
    } catch (error) {
      yield {
        level: 'error',
        message: `Failed to remove job workspace: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'cleanup',
      };
      // Don't throw - cleanup is best effort
    }
  }

  /**
   * Full cleanup between jobs
   * This runs all cleanup operations to prepare for the next job
   */
  async *cleanupBetweenJobs(
    jobId: string,
    jobWorkspacePath: string
  ): AsyncGenerator<LogMessage> {
    yield {
      level: 'info',
      message: `Starting full cleanup for job ${jobId}`,
      timestamp: new Date().toISOString(),
      jobId,
      stage: 'cleanup',
    };

    // Kill processes
    for await (const log of this.killProcesses(jobId)) {
      yield log;
    }

    // Clear temp files
    for await (const log of this.clearTempFiles(jobId)) {
      yield log;
    }

    // Reset environment
    for await (const log of this.resetEnvironment(jobId)) {
      yield log;
    }

    // Remove job workspace
    for await (const log of this.removeJobWorkspace(jobWorkspacePath, jobId)) {
      yield log;
    }

    yield {
      level: 'info',
      message: `Completed full cleanup for job ${jobId}`,
      timestamp: new Date().toISOString(),
      jobId,
      stage: 'cleanup',
    };
  }
}

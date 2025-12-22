import simpleGit, { SimpleGit } from 'simple-git';
import type { LogMessage } from '@sia/models';
import type { ContainerManager } from '../container/container-manager.js';

export interface GitCredentials {
  token?: string;
  username?: string;
  password?: string;
}

export class GitService {
  private git: SimpleGit;
  private containerManager?: ContainerManager;
  private workspacePath: string;

  constructor(workspacePath: string, containerManager?: ContainerManager) {
    this.workspacePath = workspacePath;
    this.git = simpleGit(workspacePath);
    this.containerManager = containerManager;
  }

  private buildRepoUrl(repoId: string, credentials?: GitCredentials): string {
    // Parse repoId to determine if it's a full URL or just owner/repo

    if (
      repoId.startsWith('http://') ||
      repoId.startsWith('https://') ||
      repoId.startsWith('git@')
    ) {
      // Full URL provided
      if (credentials?.token && repoId.startsWith('https://')) {
        // Inject token into HTTPS URL based on token type
        const token = credentials.token;

        if (repoId.includes('github.com')) {
          // GitHub: Use x-access-token format for all token types
          // This works with personal access tokens, fine-grained tokens, and app tokens
          return repoId.replace(
            'https://github.com/',
            `https://x-access-token:${token}@github.com/`
          );
        } else {
          // Other git providers - use standard basic auth
          return repoId.replace('https://', `https://${token}:x-oauth-basic@`);
        }
      }
      return repoId;
    }

    // Assume GitHub format: owner/repo
    if (credentials?.token) {
      const token = credentials.token;
      // Use x-access-token format for all GitHub token types
      return `https://x-access-token:${token}@github.com/${repoId}.git`;
    }

    return `https://github.com/${repoId}.git`;
  }

  async *cloneRepository(
    repoId: string,
    jobId: string,
    credentials?: GitCredentials
  ): AsyncGenerator<LogMessage> {
    try {
      const repoUrl = this.buildRepoUrl(repoId, credentials);

      yield {
        level: 'info',
        message: `Cloning repository: ${repoId}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'clone',
      };

      await this.git.clone(repoUrl, '.');

      yield {
        level: 'success',
        message: `Successfully cloned repository: ${repoId}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'clone',
      };
    } catch (error) {
      yield {
        level: 'error',
        message: `Failed to clone repository: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'clone',
      };
      throw error;
    }
  }

  async *checkoutBranch(
    branch: string,
    jobId: string
  ): AsyncGenerator<LogMessage> {
    try {
      yield {
        level: 'info',
        message: `Checking out branch: ${branch}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'checkout',
      };

      await this.git.checkout(branch);

      yield {
        level: 'success',
        message: `Successfully checked out branch: ${branch}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'checkout',
      };
    } catch (error) {
      yield {
        level: 'error',
        message: `Failed to checkout branch: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'checkout',
      };
      throw error;
    }
  }

  async *createBranch(
    branchName: string,
    jobId: string
  ): AsyncGenerator<LogMessage> {
    try {
      yield {
        level: 'info',
        message: `Creating branch: ${branchName}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'git',
      };

      await this.git.checkoutLocalBranch(branchName);

      yield {
        level: 'success',
        message: `Successfully created branch: ${branchName}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'git',
      };
    } catch (error) {
      yield {
        level: 'error',
        message: `Failed to create branch: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'git',
      };
      throw error;
    }
  }

  /**
   * Create a new branch in a worktree (for making changes)
   * This creates and checks out a new branch in the specified worktree path
   */
  async *createBranchInWorktree(
    worktreePath: string,
    branchName: string,
    jobId?: string
  ): AsyncGenerator<LogMessage> {
    try {
      yield {
        level: 'info',
        message: `Creating branch ${branchName} in worktree ${worktreePath}`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'git',
      };

      // Create and checkout new branch in the worktree
      await this.execGitCommand(
        `git -C "${worktreePath}" checkout -b "${branchName}"`,
        jobId
      );

      yield {
        level: 'success',
        message: `Successfully created branch ${branchName}`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'git',
      };
    } catch (error) {
      // Check if error is about branch already existing
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStderr =
        typeof error === 'object' && error !== null && 'stderr' in error
          ? String(error.stderr)
          : '';

      const isBranchExistsError =
        (errorMessage.includes('already exists') &&
          errorMessage.includes('branch')) ||
        (errorStderr.includes('already exists') &&
          errorStderr.includes('branch'));

      if (isBranchExistsError) {
        // Branch already exists, checkout the existing branch
        yield {
          level: 'info',
          message: `Branch ${branchName} already exists, checking out existing branch`,
          timestamp: new Date().toISOString(),
          jobId: jobId || 'unknown',
          stage: 'git',
        };

        // Checkout the existing branch
        await this.execGitCommand(
          `git -C "${worktreePath}" checkout "${branchName}"`,
          jobId
        );

        yield {
          level: 'success',
          message: `Successfully checked out existing branch ${branchName}`,
          timestamp: new Date().toISOString(),
          jobId: jobId || 'unknown',
          stage: 'git',
        };
        return;
      }

      yield {
        level: 'error',
        message: `Failed to create branch in worktree: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'git',
      };
      throw error;
    }
  }

  async *addAll(jobId: string): AsyncGenerator<LogMessage> {
    try {
      yield {
        level: 'info',
        message: 'Adding all changes to git',
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'git',
      };

      await this.git.add('.');

      yield {
        level: 'success',
        message: 'Successfully added all changes',
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'git',
      };
    } catch (error) {
      yield {
        level: 'error',
        message: `Failed to add changes: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'git',
      };
      throw error;
    }
  }

  async *commit(message: string, jobId: string): AsyncGenerator<LogMessage> {
    try {
      yield {
        level: 'info',
        message: `Committing changes with message: ${message}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'git',
      };

      await this.git.commit(message);

      yield {
        level: 'success',
        message: 'Successfully committed changes',
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'git',
      };
    } catch (error) {
      yield {
        level: 'error',
        message: `Failed to commit: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'git',
      };
      throw error;
    }
  }

  async *push(
    branchName: string,
    credentials?: GitCredentials,
    jobId?: string
  ): AsyncGenerator<LogMessage> {
    try {
      yield {
        level: 'info',
        message: `Pushing branch: ${branchName}`,
        timestamp: new Date().toISOString(),
        jobId: jobId || '',
        stage: 'git',
      };

      // TODO: Configure git credentials for push if needed
      // This might require setting up git config or using credential helper
      await this.git.push('origin', branchName);

      yield {
        level: 'success',
        message: `Successfully pushed branch: ${branchName}`,
        timestamp: new Date().toISOString(),
        jobId: jobId || '',
        stage: 'git',
      };
    } catch (error) {
      yield {
        level: 'error',
        message: `Failed to push: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp: new Date().toISOString(),
        jobId: jobId || '',
        stage: 'git',
      };
      throw error;
    }
  }

  async getDiff(baseBranch = 'main'): Promise<string> {
    try {
      const diff = await this.git.diff([`origin/${baseBranch}...HEAD`]);
      return diff || '';
    } catch (error) {
      // If diff fails, try without origin prefix
      try {
        const diff = await this.git.diff([`${baseBranch}...HEAD`]);
        return diff || '';
      } catch {
        // Fallback to staged and unstaged changes
        return (await this.git.diff()) || '';
      }
    }
  }

  async getStatus(): Promise<{
    files: string[];
    staged: string[];
    modified: string[];
    created: string[];
    currentBranch?: string;
  }> {
    try {
      const status = await this.git.status();
      return {
        files: status.files.map(f => f.path),
        // Use status.staged directly - files that are staged for commit
        staged: status.staged || [],
        // Use status.modified directly - files modified but not staged
        modified: status.modified || [],
        // Use status.not_added for untracked files (created but not added)
        // Also include status.created if it exists (newly created files)
        created: [...(status.not_added || []), ...(status.created || [])],
        currentBranch: status.current || undefined,
      };
    } catch (error) {
      return {
        files: [],
        staged: [],
        modified: [],
        created: [],
        currentBranch: undefined,
      };
    }
  }

  async createPullRequest(
    repoId: string,
    branchName: string,
    title: string,
    body: string,
    credentials?: GitCredentials
  ): Promise<string> {
    // Extract owner and repo from repoId
    // repoId can be in format: owner/repo (preferred) or numeric ID
    let owner: string;
    let repo: string;

    if (repoId.includes('/')) {
      // Format: owner/repo
      const parts = repoId.split('/');
      owner = parts[0];
      repo = parts[1];
      if (!owner || !repo) {
        throw new Error(
          `Invalid repoId format: ${repoId}. Expected format: owner/repo`
        );
      }
    } else {
      // Numeric ID - cannot create PR without owner/repo
      throw new Error(
        `Invalid repoId format: ${repoId}. Cannot create PR with numeric ID. Expected format: owner/repo`
      );
    }

    const token = credentials?.token || process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GitHub token is required to create PR');
    }

    // Use GitHub API to create PR
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        method: 'POST',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          body,
          head: branchName,
          base: 'main',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create PR: ${error}`);
    }

    const prData = (await response.json()) as { html_url: string };
    return prData.html_url;
  }

  /**
   * Execute git command in container (if containerManager is provided) or locally
   */
  private async execGitCommand(command: string, jobId?: string): Promise<void> {
    if (this.containerManager) {
      const result = await this.containerManager.execInContainer(
        command,
        this.workspacePath
      );
      if (result.exitCode !== 0) {
        throw new Error(
          `Git command failed: ${result.stderr || result.stdout}`
        );
      }
    } else {
      // Execute locally using execa
      const { execa } = await import('execa');
      await execa('sh', ['-c', command], {
        cwd: this.workspacePath,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0', // Disable interactive prompts
        },
      });
    }
  }

  /**
   * Check if a directory exists
   */
  private async directoryExists(path: string): Promise<boolean> {
    try {
      if (this.containerManager) {
        const result = await this.containerManager.execInContainer(
          `test -d "${path}"`,
          this.workspacePath
        );
        return result.exitCode === 0;
      } else {
        const fs = await import('fs/promises');
        await fs.access(path);
        return true;
      }
    } catch {
      return false;
    }
  }

  /**
   * Clone repository as bare (for git worktrees)
   * This creates a bare repository that can be used as the source for multiple worktrees
   */
  async *cloneBareRepository(
    repoId: string,
    bareRepoPath: string,
    credentials?: GitCredentials,
    jobId?: string
  ): AsyncGenerator<LogMessage> {
    try {
      const repoUrl = this.buildRepoUrl(repoId, credentials);

      // Log credential status for debugging
      const hasCredentials = !!(credentials?.token || credentials?.username);
      yield {
        level: 'info',
        message: `Cloning bare repository: ${repoId} to ${bareRepoPath}${
          hasCredentials
            ? ' (using credentials)'
            : ' (no credentials - public repo only)'
        }`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'clone',
      };

      // Check if bare repo already exists and delete it for a fresh clone
      const bareRepoExists = await this.directoryExists(bareRepoPath);
      if (bareRepoExists) {
        yield {
          level: 'info',
          message: `Bare repository already exists at ${bareRepoPath}, cleaning up worktrees and deleting for fresh clone`,
          timestamp: new Date().toISOString(),
          jobId: jobId || 'unknown',
          stage: 'clone',
        };

        // First, remove all worktrees associated with this bare repo
        try {
          const { execa } = await import('execa');
          const { stdout } = await execa(
            'git',
            ['-C', bareRepoPath, 'worktree', 'list', '--porcelain'],
            {
              env: {
                ...process.env,
                GIT_TERMINAL_PROMPT: '0',
              },
            }
          );

          // Parse worktree list to find all worktrees
          const lines = stdout.split('\n');
          const worktreesToRemove: string[] = [];

          for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('worktree ')) {
              const path = lines[i].substring('worktree '.length);
              worktreesToRemove.push(path);
            }
          }

          // Remove all worktrees
          for (const worktreePath of worktreesToRemove) {
            try {
              yield {
                level: 'info',
                message: `Removing worktree at ${worktreePath}`,
                timestamp: new Date().toISOString(),
                jobId: jobId || 'unknown',
                stage: 'clone',
              };

              await this.execGitCommand(
                `git -C "${bareRepoPath}" worktree remove "${worktreePath}" --force`,
                jobId
              );

              // Also remove the directory if it still exists
              await this.execGitCommand(
                `rm -rf "${worktreePath}"`,
                jobId
              ).catch(() => {
                // Ignore errors, directory might already be gone
              });
            } catch (err) {
              // Ignore errors for individual worktree removal
              yield {
                level: 'warn',
                message: `Failed to remove worktree at ${worktreePath}: ${
                  err instanceof Error ? err.message : 'Unknown error'
                }`,
                timestamp: new Date().toISOString(),
                jobId: jobId || 'unknown',
                stage: 'clone',
              };
            }
          }

          // Prune stale worktree entries
          await this.execGitCommand(
            `git -C "${bareRepoPath}" worktree prune`,
            jobId
          ).catch(() => {
            // Ignore errors
          });
        } catch (error) {
          // If listing worktrees fails, continue with deletion anyway
          yield {
            level: 'warn',
            message: `Failed to list worktrees before deletion: ${
              error instanceof Error ? error.message : 'Unknown error'
            }. Proceeding with deletion anyway.`,
            timestamp: new Date().toISOString(),
            jobId: jobId || 'unknown',
            stage: 'clone',
          };
        }

        // Delete the bare repository directory (includes .git folder and worktrees directory)
        await this.execGitCommand(`rm -rf "${bareRepoPath}"`, jobId);

        yield {
          level: 'info',
          message: `Deleted existing bare repository and all associated worktrees, proceeding with fresh clone`,
          timestamp: new Date().toISOString(),
          jobId: jobId || 'unknown',
          stage: 'clone',
        };
      }

      // Clone as bare
      await this.execGitCommand(
        `git clone --bare "${repoUrl}" "${bareRepoPath}"`,
        jobId
      );

      yield {
        level: 'success',
        message: `Successfully cloned bare repository: ${repoId}`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'clone',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Provide helpful error messages based on the error type
      let helpfulMessage = `Failed to clone bare repository: ${errorMessage}`;

      if (errorMessage.includes('Repository not found')) {
        const hasCredentials = !!(credentials?.token || credentials?.username);
        if (!hasCredentials) {
          helpfulMessage = `Failed to clone bare repository: Repository not found. This repository may be private. Please ensure GitHub credentials are configured in the job settings.`;
        } else {
          helpfulMessage = `Failed to clone bare repository: Repository not found. Please verify:
1. The repository URL is correct: ${repoId}
2. The repository exists on GitHub
3. The GitHub token has access to this repository`;
        }
      } else if (errorMessage.includes('Authentication failed')) {
        helpfulMessage = `Failed to clone bare repository: Authentication failed. Please check that your GitHub token is valid and has not expired.`;
      }

      yield {
        level: 'error',
        message: helpfulMessage,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'clone',
      };
      throw error;
    }
  }

  /**
   * Create a worktree from a bare repository, checking out an existing branch
   * This creates a working directory linked to the bare repo for a specific job
   */
  async *createWorktree(
    bareRepoPath: string,
    worktreePath: string,
    branchName: string,
    jobId?: string
  ): AsyncGenerator<LogMessage> {
    try {
      yield {
        level: 'info',
        message: `Creating worktree at ${worktreePath} for branch ${branchName}`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'worktree',
      };

      // Ensure parent directory exists
      await this.execGitCommand(
        `mkdir -p "$(dirname "${worktreePath}")"`,
        jobId
      );

      // Create worktree - create new branch from HEAD
      await this.execGitCommand(
        `git -C "${bareRepoPath}" worktree add "${worktreePath}" -b "${branchName}"`,
        jobId
      );

      yield {
        level: 'success',
        message: `Successfully created worktree at ${worktreePath}`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'worktree',
      };
    } catch (error) {
      yield {
        level: 'error',
        message: `Failed to create worktree: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'worktree',
      };
      throw error;
    }
  }

  /**
   * Create a worktree from an existing remote branch
   * This checks out an existing branch rather than creating a new one
   */
  async *createWorktreeFromBranch(
    bareRepoPath: string,
    worktreePath: string,
    baseBranch: string,
    jobId?: string
  ): AsyncGenerator<LogMessage> {
    try {
      // Extract job directory to find all worktrees for this job
      const jobDirMatch = worktreePath.match(/(.+\/jobs\/[^/]+)\//);
      const jobDir = jobDirMatch ? jobDirMatch[1] : null;

      // Prune any stale worktrees for this job
      if (jobDir) {
        yield {
          level: 'info',
          message: `Cleaning up any stale worktrees for job in ${jobDir}`,
          timestamp: new Date().toISOString(),
          jobId: jobId || 'unknown',
          stage: 'worktree',
        };

        // List all worktrees and remove any that belong to this job
        try {
          const { execa } = await import('execa');
          const { stdout } = await execa(
            'git',
            ['-C', bareRepoPath, 'worktree', 'list', '--porcelain'],
            {
              env: {
                ...process.env,
                GIT_TERMINAL_PROMPT: '0',
              },
            }
          );

          // Parse worktree list to find job-related worktrees
          const lines = stdout.split('\n');
          const worktreesToRemove: string[] = [];

          for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('worktree ')) {
              const path = lines[i].substring('worktree '.length);
              if (path.includes(jobDir)) {
                worktreesToRemove.push(path);
              }
            }
          }

          // Remove all job-related worktrees
          for (const path of worktreesToRemove) {
            yield {
              level: 'info',
              message: `Removing stale worktree at ${path}`,
              timestamp: new Date().toISOString(),
              jobId: jobId || 'unknown',
              stage: 'worktree',
            };

            try {
              await this.execGitCommand(
                `git -C "${bareRepoPath}" worktree remove "${path}" --force`,
                jobId
              );
            } catch (err) {
              // Ignore errors, worktree might already be gone
            }

            // Also remove the directory
            if (!this.containerManager) {
              const fs = await import('fs/promises');
              await fs.rm(path, { recursive: true, force: true }).catch(e => {
                console.error(
                  `Failed to remove worktree at ${path}: ${
                    e instanceof Error ? e.message : 'Unknown error'
                  }`
                );
              });
            } else {
              await this.execGitCommand(`rm -rf "${path}"`, jobId).catch(e => {
                console.error(
                  `Failed to remove worktree at ${path}: ${
                    e instanceof Error ? e.message : 'Unknown error'
                  }`
                );
              });
            }
          }

          // Prune stale worktree entries
          await this.execGitCommand(
            `git -C "${bareRepoPath}" worktree prune`,
            jobId
          );
        } catch (error) {
          yield {
            level: 'info',
            message: `Failed to list/cleanup worktrees: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
            timestamp: new Date().toISOString(),
            jobId: jobId || 'unknown',
            stage: 'worktree',
          };
        }
      }

      yield {
        level: 'info',
        message: `Creating worktree at ${worktreePath} from branch ${baseBranch}`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'worktree',
      };

      // Ensure parent directory exists
      await this.execGitCommand(
        `mkdir -p "$(dirname "${worktreePath}")"`,
        jobId
      );

      // Create worktree from existing branch (creates local tracking branch)
      // First try with origin/<branch>, fall back to just <branch>
      try {
        await this.execGitCommand(
          `git -C "${bareRepoPath}" worktree add "${worktreePath}" "origin/${baseBranch}"`,
          jobId
        );
      } catch (error) {
        // If origin/<branch> doesn't exist, try just <branch>
        await this.execGitCommand(
          `git -C "${bareRepoPath}" worktree add "${worktreePath}" "${baseBranch}"`,
          jobId
        );
      }

      yield {
        level: 'success',
        message: `Successfully created worktree at ${worktreePath} from branch ${baseBranch}`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'worktree',
      };
    } catch (error) {
      yield {
        level: 'error',
        message: `Failed to create worktree from branch: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'worktree',
      };
      throw error;
    }
  }

  /**
   * Remove a worktree (cleanup after job completion)
   */
  async *removeWorktree(
    bareRepoPath: string,
    worktreePath: string,
    jobId?: string
  ): AsyncGenerator<LogMessage> {
    try {
      yield {
        level: 'info',
        message: `Removing worktree at ${worktreePath}`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'cleanup',
      };

      // Remove worktree
      await this.execGitCommand(
        `git -C ${bareRepoPath} worktree remove ${worktreePath} --force`,
        jobId
      );

      yield {
        level: 'success',
        message: `Successfully removed worktree at ${worktreePath}`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'cleanup',
      };
    } catch (error) {
      yield {
        level: 'error',
        message: `Failed to remove worktree: ${
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
   * List all worktrees for a bare repository
   */
  async listWorktrees(bareRepoPath: string): Promise<string[]> {
    try {
      if (this.containerManager) {
        const result = await this.containerManager.execInContainer(
          `git -C ${bareRepoPath} worktree list --porcelain`,
          this.workspacePath
        );
        // Parse worktree list output
        const lines = result.stdout.split('\n');
        const worktrees: string[] = [];
        for (const line of lines) {
          if (line.startsWith('worktree ')) {
            worktrees.push(line.substring('worktree '.length));
          }
        }
        return worktrees;
      }
      return [];
    } catch (error) {
      console.error('Failed to list worktrees:', error);
      return [];
    }
  }
}

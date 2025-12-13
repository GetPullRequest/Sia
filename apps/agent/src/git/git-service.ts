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
    // TODO: Parse repoId to determine if it's a full URL or just owner/repo
    // For now, assume it's in format: owner/repo or full GitHub URL

    if (
      repoId.startsWith('http://') ||
      repoId.startsWith('https://') ||
      repoId.startsWith('git@')
    ) {
      // Full URL provided
      if (credentials?.token && repoId.startsWith('https://')) {
        // Inject token into HTTPS URL
        const url = new URL(repoId);
        url.username = credentials.username || 'git';
        url.password = credentials.token;
        return url.toString();
      }
      return repoId;
    }

    // Assume GitHub format: owner/repo
    if (credentials?.token) {
      return `https://${credentials.username || 'git'}:${
        credentials.token
      }@github.com/${repoId}.git`;
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

  async createPullRequest(
    repoId: string,
    branchName: string,
    title: string,
    body: string,
    credentials?: GitCredentials
  ): Promise<string> {
    // Extract owner and repo from repoId (format: owner/repo)
    const [owner, repo] = repoId.split('/');
    if (!owner || !repo) {
      throw new Error(
        `Invalid repoId format: ${repoId}. Expected format: owner/repo`
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
          base: 'main', // TODO: Make base branch configurable
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
   * Execute git command in container (if containerManager is provided)
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
      // Fallback to local execution (not recommended for production)
      const { execa } = await import('execa');
      await execa('sh', ['-c', command], { cwd: this.workspacePath });
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

      yield {
        level: 'info',
        message: `Cloning bare repository: ${repoId} to ${bareRepoPath}`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'clone',
      };

      // Check if bare repo already exists
      if (this.containerManager) {
        const checkResult = await this.containerManager.execInContainer(
          `test -d ${bareRepoPath}`,
          this.workspacePath
        );
        if (checkResult.exitCode === 0) {
          yield {
            level: 'info',
            message: `Bare repository already exists at ${bareRepoPath}, fetching latest changes`,
            timestamp: new Date().toISOString(),
            jobId: jobId || 'unknown',
            stage: 'clone',
          };
          // Fetch latest changes
          await this.execGitCommand(
            `git -C ${bareRepoPath} fetch --all`,
            jobId
          );
          return;
        }
      }

      // Clone as bare
      await this.execGitCommand(
        `git clone --bare ${repoUrl} ${bareRepoPath}`,
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
      yield {
        level: 'error',
        message: `Failed to clone bare repository: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage: 'clone',
      };
      throw error;
    }
  }

  /**
   * Create a worktree from a bare repository
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
      await this.execGitCommand(`mkdir -p $(dirname ${worktreePath})`, jobId);

      // Create worktree
      await this.execGitCommand(
        `git -C ${bareRepoPath} worktree add ${worktreePath} -b ${branchName}`,
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

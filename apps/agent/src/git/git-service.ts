import simpleGit, { SimpleGit } from 'simple-git';
import type { LogMessage } from '@sia/models';

export interface GitCredentials {
  token?: string;
  username?: string;
  password?: string;
}

export class GitService {
  private git: SimpleGit;

  constructor(workspacePath: string) {
    this.git = simpleGit(workspacePath);
  }

  private buildRepoUrl(repoId: string, credentials?: GitCredentials): string {
    // TODO: Parse repoId to determine if it's a full URL or just owner/repo
    // For now, assume it's in format: owner/repo or full GitHub URL
    
    if (repoId.startsWith('http://') || repoId.startsWith('https://') || repoId.startsWith('git@')) {
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
      return `https://${credentials.username || 'git'}:${credentials.token}@github.com/${repoId}.git`;
    }
    
    return `https://github.com/${repoId}.git`;
  }

  async* cloneRepository(
    repoId: string,
    jobId: string,
    credentials?: GitCredentials,
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
        message: `Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'clone',
      };
      throw error;
    }
  }

  async* checkoutBranch(branch: string, jobId: string): AsyncGenerator<LogMessage> {
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
        message: `Failed to checkout branch: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'checkout',
      };
      throw error;
    }
  }

  async* createBranch(branchName: string, jobId: string): AsyncGenerator<LogMessage> {
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
        message: `Failed to create branch: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'git',
      };
      throw error;
    }
  }

  async* addAll(jobId: string): AsyncGenerator<LogMessage> {
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
        message: `Failed to add changes: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'git',
      };
      throw error;
    }
  }

  async* commit(message: string, jobId: string): AsyncGenerator<LogMessage> {
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
        message: `Failed to commit: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'git',
      };
      throw error;
    }
  }

  async* push(branchName: string, credentials?: GitCredentials, jobId?: string): AsyncGenerator<LogMessage> {
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
        message: `Failed to push: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      throw new Error(`Invalid repoId format: ${repoId}. Expected format: owner/repo`);
    }

    const token = credentials?.token || process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GitHub token is required to create PR');
    }

    // Use GitHub API to create PR
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body,
        head: branchName,
        base: 'main', // TODO: Make base branch configurable
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create PR: ${error}`);
    }

    const prData = await response.json() as { html_url: string };
    return prData.html_url;
  }
}



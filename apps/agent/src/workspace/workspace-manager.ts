import type { LogMessage } from '@sia/models';

/**
 * WorkspaceManager handles workspace structure for git worktrees.
 *
 * Structure:
 * /workspace/
 * ├── .bare-repos/           # Bare git repositories (shared across jobs)
 * │   ├── frontend.git/
 * │   └── backend.git/
 * └── jobs/                  # Job-specific worktrees
 *     ├── job-123/
 *     │   ├── frontend/      # Worktree from frontend.git
 *     │   └── backend/       # Worktree from backend.git
 *     └── job-456/
 *         └── frontend/
 */
export class WorkspaceManager {
  private bareReposPath: string;
  private jobsPath: string;

  constructor(basePath = '/workspace') {
    this.bareReposPath = `${basePath}/.bare-repos`;
    this.jobsPath = `${basePath}/jobs`;
  }

  /**
   * Get the path for bare repositories
   */
  getBareReposPath(): string {
    return this.bareReposPath;
  }

  /**
   * Get the path for a specific bare repository
   * @param repoId - Repository identifier (e.g., "org/frontend")
   * @returns Path like "/workspace/.bare-repos/org-frontend.git"
   */
  getBareRepoPath(repoId: string): string {
    // Sanitize repoId to create a valid directory name
    const sanitized = repoId
      .replace(/\//g, '-')
      .replace(/[^a-zA-Z0-9-_]/g, '_');
    return `${this.bareReposPath}/${sanitized}.git`;
  }

  /**
   * Get the base path for all jobs
   */
  getJobsPath(): string {
    return this.jobsPath;
  }

  /**
   * Get the workspace path for a specific job
   * @param jobId - Job identifier
   * @returns Path like "/workspace/jobs/job-123"
   */
  getJobWorkspace(jobId: string): string {
    return `${this.jobsPath}/${jobId}`;
  }

  /**
   * Get the path for a specific repo worktree within a job
   * @param jobId - Job identifier
   * @param repoName - Repository name (e.g., "frontend")
   * @returns Path like "/workspace/jobs/job-123/frontend"
   */
  getRepoWorktreePath(jobId: string, repoName: string): string {
    return `${this.jobsPath}/${jobId}/${repoName}`;
  }

  /**
   * Get workspace path (legacy method for backward compatibility)
   * @deprecated Use getJobWorkspace instead
   */
  getWorkspacePath(jobId: string, attemptNumber: number): string {
    // For backward compatibility, use job-specific workspace
    return this.getJobWorkspace(`${jobId}-${attemptNumber}`);
  }

  /**
   * Generate logs for workspace creation (container handles actual creation)
   */
  async *createWorkspaceWithLogs(
    jobId: string,
    attemptNumber: number
  ): AsyncGenerator<LogMessage, string> {
    try {
      const workspacePath = this.getJobWorkspace(jobId);

      yield {
        level: 'info',
        message: `Workspace will be created at ${workspacePath} in container`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'setup',
      };

      return workspacePath;
    } catch (error) {
      yield {
        level: 'error',
        message: `Failed to prepare workspace: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'setup',
      };
      throw error;
    }
  }

  /**
   * Cleanup job workspace (note: actual deletion happens in container)
   */
  async cleanupWorkspace(jobId: string, attemptNumber: number): Promise<void> {
    // This is now handled by the container cleanup
    // Keep method for backward compatibility
    console.log(
      `Cleanup scheduled for workspace: ${this.getJobWorkspace(jobId)}`
    );
  }

  /**
   * Get all paths for a job with multiple repos
   */
  getJobRepoPaths(
    jobId: string,
    repoNames: string[]
  ): { jobWorkspace: string; repoPaths: Record<string, string> } {
    const jobWorkspace = this.getJobWorkspace(jobId);
    const repoPaths: Record<string, string> = {};

    for (const repoName of repoNames) {
      repoPaths[repoName] = this.getRepoWorktreePath(jobId, repoName);
    }

    return { jobWorkspace, repoPaths };
  }
}

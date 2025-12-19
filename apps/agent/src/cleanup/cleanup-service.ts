import type { ContainerManager } from '../container/container-manager.js';
import type { LogMessage } from '@sia/models';

export class CleanupService {
  private containerManager: ContainerManager;

  constructor(containerManager: ContainerManager) {
    this.containerManager = containerManager;
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
   * Remove job workspace directory
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

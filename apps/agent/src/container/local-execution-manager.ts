import type { LogMessage } from '@sia/models';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export interface LocalExecutionConfig {
  workspaceDir: string;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * LocalExecutionManager executes commands directly on the host machine
 * without using Docker. This is useful for development environments.
 */
export class LocalExecutionManager {
  private config: LocalExecutionConfig;

  constructor(config?: Partial<LocalExecutionConfig>) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
    this.config = {
      workspaceDir:
        config?.workspaceDir || path.join(homeDir, '.sia', 'workspace'),
    };
  }

  /**
   * Ensure the workspace directory exists
   */
  async ensureWorkspaceReady(): Promise<void> {
    try {
      // Create workspace directory structure
      const bareReposDir = path.join(this.config.workspaceDir, '.bare-repos');
      const jobsDir = path.join(this.config.workspaceDir, 'jobs');

      await fs.promises.mkdir(bareReposDir, { recursive: true });
      await fs.promises.mkdir(jobsDir, { recursive: true });

      console.log(`Local workspace ready at: ${this.config.workspaceDir}`);
    } catch (error) {
      throw new Error(
        `Failed to ensure workspace ready: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Execute a command locally and return the result
   */
  async execInContainer(
    command: string | string[],
    workDir?: string
  ): Promise<ExecResult> {
    try {
      const cmd = Array.isArray(command) ? command.join(' ') : command;
      const cwd = workDir || this.config.workspaceDir;

      const { stdout, stderr } = await execAsync(cmd, {
        cwd,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      return {
        exitCode: 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };
    } catch (error: any) {
      return {
        exitCode: error.code || 1,
        stdout: error.stdout?.trim() || '',
        stderr: error.stderr?.trim() || error.message,
      };
    }
  }

  /**
   * Execute a command locally and stream output as log messages
   */
  async *execStreamInContainer(
    command: string | string[],
    workDir?: string,
    jobId?: string,
    stage = 'local'
  ): AsyncGenerator<LogMessage> {
    try {
      const cmd = Array.isArray(command) ? command.join(' ') : command;

      yield {
        level: 'info',
        message: `Executing locally: ${cmd}`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage,
      };

      const result = await this.execInContainer(command, workDir);

      if (result.stdout) {
        yield {
          level: 'info',
          message: result.stdout,
          timestamp: new Date().toISOString(),
          jobId: jobId || 'unknown',
          stage,
        };
      }

      if (result.stderr) {
        yield {
          level: 'warn',
          message: result.stderr,
          timestamp: new Date().toISOString(),
          jobId: jobId || 'unknown',
          stage,
        };
      }

      if (result.exitCode === 0) {
        yield {
          level: 'info',
          message: `Command completed successfully`,
          timestamp: new Date().toISOString(),
          jobId: jobId || 'unknown',
          stage,
        };
      } else {
        yield {
          level: 'error',
          message: `Command failed with exit code ${result.exitCode}`,
          timestamp: new Date().toISOString(),
          jobId: jobId || 'unknown',
          stage,
        };
        throw new Error(`Command failed with exit code ${result.exitCode}`);
      }
    } catch (error) {
      yield {
        level: 'error',
        message: `Failed to execute command: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage,
      };
      throw error;
    }
  }

  /**
   * No-op for local execution (no container to stop)
   */
  async stopContainer(): Promise<void> {
    console.log('Local execution mode - no container to stop');
  }

  /**
   * Get workspace status
   */
  async getStatus(): Promise<{
    running: boolean;
    workspaceDir: string;
  }> {
    return {
      running: true,
      workspaceDir: this.config.workspaceDir,
    };
  }

  /**
   * Get the workspace directory path
   */
  getWorkspaceDir(): string {
    return this.config.workspaceDir;
  }
}

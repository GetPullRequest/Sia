import { mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { LogMessage } from '@sia/models';

export class WorkspaceManager {
  private basePath: string;

  constructor(basePath = '/tmp') {
    this.basePath = basePath;
  }

  async createWorkspace(jobId: string, attemptNumber: number): Promise<string> {
    const workspacePath = join(this.basePath, jobId, attemptNumber.toString());
    
    if (!existsSync(workspacePath)) {
      await mkdir(workspacePath, { recursive: true });
    }

    return workspacePath;
  }

  async* createWorkspaceWithLogs(
    jobId: string,
    attemptNumber: number
  ): AsyncGenerator<LogMessage, string> {
    try {
      const workspacePath = await this.createWorkspace(jobId, attemptNumber);
      
      yield {
        level: 'info',
        message: `Created workspace at ${workspacePath}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'setup',
      };

      return workspacePath;
    } catch (error) {
      yield {
        level: 'error',
        message: `Failed to create workspace: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'setup',
      };
      throw error;
    }
  }

  async cleanupWorkspace(jobId: string, attemptNumber: number): Promise<void> {
    const workspacePath = join(this.basePath, jobId, attemptNumber.toString());
    
    if (existsSync(workspacePath)) {
      await rm(workspacePath, { recursive: true, force: true });
    }
  }

  getWorkspacePath(jobId: string, attemptNumber: number): string {
    return join(this.basePath, jobId, attemptNumber.toString());
  }
}


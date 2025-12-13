import { AgentClient } from './agent-client';
import { logStorage } from './log-storage';
import { websocketManager } from './websocket-manager';
import { db, schema } from '../db/index';
import { eq, and, desc } from 'drizzle-orm';
import type { LogMessage } from '@sia/models/proto';

export class JobExecutionService {
  private activeExecutions: Map<string, AgentClient> = new Map();
  private pausedJobs: Set<string> = new Set();

  async executeJob(
    jobId: string,
    orgId: string,
    options?: { additionalLogHandler?: (log: LogMessage) => void }
  ): Promise<void> {
    const jobResult = await db
      .select()
      .from(schema.jobs)
      .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.orgId, orgId)))
      .orderBy(desc(schema.jobs.version))
      .limit(1);

    if (!jobResult[0]) {
      throw new Error('Job not found or does not belong to organization');
    }

    const job = jobResult[0];
    const prompt = job.userInput?.prompt || '';

    const existingUpdates = job.updates || '';
    const timestamp = new Date().toLocaleString();
    const updateMessage = `Job execution started at ${timestamp}.`;
    const newUpdates = existingUpdates
      ? `${existingUpdates}\n${updateMessage}`
      : updateMessage;

    await db
      .update(schema.jobs)
      .set({
        status: 'in-progress',
        queueType: null,
        orderInQueue: -1,
        updates: newUpdates,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.orgId, orgId)));

    const agentClient = new AgentClient();
    this.activeExecutions.set(jobId, agentClient);

    try {
      await agentClient.executeJob({
        jobId,
        prompt,
        repoId: job.repoId || undefined,
        onLog: async (log: LogMessage) => {
          await logStorage.addLog(jobId, job.version, orgId, log);

          if (websocketManager.hasSubscribers(jobId)) {
            websocketManager.broadcast(jobId, {
              type: 'log',
              data: log,
            });
          }

          if (options?.additionalLogHandler) {
            options.additionalLogHandler(log);
          }
        },
      });

      const existingUpdates = job.updates || '';
      const timestamp = new Date().toLocaleString();
      const updateMessage = `Job completed successfully at ${timestamp}.`;
      const newUpdates = existingUpdates
        ? `${existingUpdates}\n${updateMessage}`
        : updateMessage;

      await db
        .update(schema.jobs)
        .set({
          status: 'completed',
          updates: newUpdates,
          updatedAt: new Date(),
        })
        .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.orgId, orgId)));

      websocketManager.broadcast(jobId, {
        type: 'job-completed',
        jobId,
      });
    } catch (error) {
      // Extract meaningful error message
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;

        // If it's a Temporal ActivityFailure, extract the underlying cause
        if (
          errorMessage.includes('Activity task failed') ||
          errorMessage.includes('ActivityFailure')
        ) {
          // Check for cause property (Temporal wraps errors)
          const cause = (error as any).cause;
          if (cause instanceof Error) {
            errorMessage = cause.message;
          } else if (cause && typeof cause === 'string') {
            errorMessage = cause;
          } else if (error.stack) {
            // Parse stack trace to find the actual error
            const stackLines = error.stack.split('\n');
            for (const line of stackLines) {
              // Look for error messages that aren't Temporal wrapper messages
              if (
                line.includes('Error:') &&
                !line.includes('Activity task failed') &&
                !line.includes('ActivityFailure') &&
                !line.includes('WorkflowExecutionFailedError')
              ) {
                const match = line.match(/Error:\s*(.+)/);
                if (match && match[1]) {
                  const extracted = match[1].trim();
                  // Only use if it's a meaningful error (not just "Error")
                  if (extracted.length > 5 && extracted !== 'Error') {
                    errorMessage = extracted;
                    break;
                  }
                }
              }
              // Also check for "at" lines that might contain the error location
              if (
                line.trim().startsWith('at ') &&
                stackLines.indexOf(line) > 0
              ) {
                const prevLine = stackLines[stackLines.indexOf(line) - 1];
                if (
                  prevLine &&
                  prevLine.includes('Error:') &&
                  !prevLine.includes('Activity task failed')
                ) {
                  const match = prevLine.match(/Error:\s*(.+)/);
                  if (match && match[1]) {
                    errorMessage = match[1].trim();
                    break;
                  }
                }
              }
            }
          }
        }
      }

      const existingUpdates = job.updates || '';
      const timestamp = new Date().toLocaleString();
      const updateMessage = `Job execution failed at ${timestamp}. Error details: ${errorMessage}`;
      // Prepend new updates (latest first)
      const newUpdates = existingUpdates
        ? `${updateMessage}\n${existingUpdates}`
        : updateMessage;

      await db
        .update(schema.jobs)
        .set({
          status: 'failed',
          updates: newUpdates,
          updatedAt: new Date(),
        })
        .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.orgId, orgId)));

      const errorLog: LogMessage = {
        level: 'error',
        message: errorMessage,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'error',
      };

      await logStorage.addLog(jobId, job.version, orgId, errorLog);
      await logStorage.flushAll();

      websocketManager.broadcast(jobId, {
        type: 'job-failed',
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    } finally {
      agentClient.close();
      this.activeExecutions.delete(jobId);
    }
  }

  cancelJob(jobId: string): void {
    const client = this.activeExecutions.get(jobId);
    if (client) {
      client.close();
      this.activeExecutions.delete(jobId);
    }
  }

  isExecuting(jobId: string): boolean {
    return this.activeExecutions.has(jobId);
  }

  pauseJob(jobId: string): void {
    this.pausedJobs.add(jobId);
    // Note: Actual pause implementation would require agent client support
  }

  resumeJob(jobId: string): void {
    this.pausedJobs.delete(jobId);
    // Note: Actual resume implementation would require agent client support
  }

  isPaused(jobId: string): boolean {
    return this.pausedJobs.has(jobId);
  }

  /**
   * Schedule a job for execution via Temporal
   * This replaces direct executeJob calls for queued jobs
   * The job will be picked up by the queueMonitorWorkflow automatically via Temporal Schedules
   */
  async scheduleJob(
    jobId: string,
    orgId: string
  ): Promise<{ workflowId: string }> {
    const jobResult = await db
      .select()
      .from(schema.jobs)
      .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.orgId, orgId)))
      .orderBy(desc(schema.jobs.version))
      .limit(1);

    if (!jobResult[0]) {
      throw new Error('Job not found or does not belong to organization');
    }

    const job = jobResult[0];

    if (job.status !== 'queued' || !job.queueType) {
      throw new Error('Job must be in a queue to schedule');
    }

    // Job will be picked up by queueMonitorWorkflow automatically via Temporal Schedules
    // No need to start a workflow here - the queue monitor schedules handle it
    return { workflowId: `queued-${jobId}` };
  }
}

export const jobExecutionService = new JobExecutionService();

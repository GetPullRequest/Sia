import { db, schema } from '../../db/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { createTemporalClient } from '../client.js';
import { logStorage } from '../../services/log-storage.js';

/**
 * Check if a Temporal workflow is currently running
 */
async function isWorkflowRunning(workflowId: string): Promise<boolean> {
  try {
    const client = await createTemporalClient();
    const handle = client.workflow.getHandle(workflowId);
    const description = await handle.describe();
    // Check if workflow is running (not completed, failed, terminated, or cancelled)
    const status = description.status.name;
    return status === 'RUNNING';
  } catch (error) {
    // If workflow doesn't exist or error accessing it, it's not running
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes('not found') ||
      errorMessage.includes('NotFound')
    ) {
      return false;
    }
    // For other errors, log but assume not running
    console.error(`Error checking workflow status for ${workflowId}:`, error);
    return false;
  }
}

/**
 * Detect jobs that are stuck in 'in-progress' status
 * A job is considered stuck if:
 * 1. It's been in-progress for more than the threshold time without updates, OR
 * 2. The associated Temporal workflow is not running (orphan job)
 */
export async function detectStuckJobs(params: {
  orgId: string;
  stuckThresholdMinutes?: number;
}): Promise<{ detected: number; handled: number; orphanJobs: number }> {
  const thresholdMinutes = params.stuckThresholdMinutes ?? 60;
  const thresholdTime = new Date(Date.now() - thresholdMinutes * 60 * 1000);

  // Find all jobs that are in-progress (not just old ones - also check for orphan workflows)
  const inProgressJobs = await db
    .select({
      id: schema.jobs.id,
      version: schema.jobs.version,
      queueType: schema.jobs.queueType,
      orgId: schema.jobs.orgId,
      updatedAt: schema.jobs.updatedAt,
    })
    .from(schema.jobs)
    .where(
      and(
        eq(schema.jobs.orgId, params.orgId),
        eq(schema.jobs.status, 'in-progress')
      )
    );

  if (inProgressJobs.length === 0) {
    return { detected: 0, handled: 0, orphanJobs: 0 };
  }

  let handled = 0;
  let orphanJobs = 0;
  const stuckJobs: typeof inProgressJobs = [];

  // Check each in-progress job to see if it's actually stuck or orphaned
  for (const job of inProgressJobs) {
    const workflowId = `job-execution-${job.id}`;
    const isRunning = await isWorkflowRunning(workflowId);

    if (!isRunning) {
      // Workflow is not running - this is an orphan job
      orphanJobs++;
      stuckJobs.push(job);

      // Log to job that it's an orphan
      try {
        await logStorage.addLog(job.id, job.version, job.orgId, {
          level: 'error',
          message: `[System] Detected orphan job: workflow ${workflowId} is not running but job status is in-progress. Workflow may have been terminated or crashed.`,
          timestamp: new Date().toISOString(),
          jobId: job.id,
          stage: 'workflow',
        });
      } catch (logError) {
        console.error(
          `Failed to log orphan job detection for ${job.id}:`,
          logError
        );
      }
    } else if (job.updatedAt < thresholdTime) {
      // Workflow is running but job hasn't been updated in a while - might be stuck
      stuckJobs.push(job);
    }
  }

  if (stuckJobs.length === 0) {
    return { detected: 0, handled: 0, orphanJobs };
  }

  // For each stuck/orphan job, return it to the queue or mark as failed
  for (const job of stuckJobs) {
    try {
      // If the job has a queueType, return it to the queue
      // Otherwise, mark it as failed (it might have been manually queued)
      if (job.queueType) {
        // Get all jobs in the queue to find the max order
        const queueJobs = await db
          .select({
            orderInQueue: schema.jobs.orderInQueue,
          })
          .from(schema.jobs)
          .where(
            and(
              eq(schema.jobs.orgId, params.orgId),
              eq(schema.jobs.queueType, job.queueType),
              eq(schema.jobs.status, 'queued'),
              sql`${schema.jobs.orderInQueue} >= 0`
            )
          );

        // Find the max order, or default to -1 if queue is empty
        const maxOrder =
          queueJobs.length > 0
            ? Math.max(...queueJobs.map(j => j.orderInQueue))
            : -1;
        const nextOrder = maxOrder + 1;

        // Return job to queue
        await db
          .update(schema.jobs)
          .set({
            status: 'queued',
            orderInQueue: nextOrder,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.jobs.id, job.id),
              eq(schema.jobs.version, job.version),
              eq(schema.jobs.orgId, params.orgId)
            )
          );

        handled++;
      } else {
        // No queueType, mark as failed
        await db
          .update(schema.jobs)
          .set({
            status: 'failed',
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.jobs.id, job.id),
              eq(schema.jobs.version, job.version),
              eq(schema.jobs.orgId, params.orgId)
            )
          );

        handled++;
      }
    } catch (error) {
      // Log error but continue processing other stuck jobs
      console.error(`Failed to handle stuck job ${job.id}:`, error);
    }
  }

  return { detected: stuckJobs.length, handled, orphanJobs };
}

import { proxyActivities, executeChild } from '@temporalio/workflow';
import type * as activities from '../activities';
import { jobExecutionWorkflow } from './job-execution-workflow';

const { preprocessActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
  retry: {
    initialInterval: '1s',
    maximumAttempts: 3,
  },
});

/**
 * Queue Monitor Workflow
 *
 * Simplified to use only 2 steps:
 * 1. preprocess: Check orphan jobs, heartbeat if job in progress, get next job if queue not paused
 * 2. process: Start child workflow if job found, otherwise complete
 */
export async function queueMonitorWorkflow(params: {
  agentId: string;
}): Promise<{
  processed: boolean;
  jobId?: string;
  queueType?: 'rework' | 'backlog';
}> {
  const { agentId } = params;

  // Step 1: Preprocess
  const result = await preprocessActivity({ agentId });

  // Step 2: Process
  if (result.jobId && result.queueType && result.orgId) {
    try {
      await executeChild(jobExecutionWorkflow, {
        args: [
          {
            jobId: result.jobId,
            orgId: result.orgId,
            queueType: result.queueType,
            agentId,
          },
        ],
        workflowId: `job-execution-${result.jobId}`,
        workflowExecutionTimeout: '2 hours',
        workflowRunTimeout: '1 hour',
      });
      return {
        processed: true,
        jobId: result.jobId,
        queueType: result.queueType,
      };
    } catch {
      return {
        processed: false,
        jobId: result.jobId,
        queueType: result.queueType,
      };
    }
  }

  return { processed: false };
}

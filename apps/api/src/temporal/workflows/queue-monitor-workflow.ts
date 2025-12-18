import {
  proxyActivities,
  executeChild,
  ParentClosePolicy,
} from '@temporalio/workflow';
import type * as activities from '../activities';
import { jobExecutionWorkflow } from './job-execution-workflow.js';

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
 * 2. process: Start child workflow in fire-and-forget mode, return immediately
 *
 * The child workflow (job execution) runs independently with ParentClosePolicy.ABANDON,
 * ensuring the queue monitor completes quickly while jobs execute for hours.
 */
export async function queueMonitorWorkflow(params: {
  agentId: string;
}): Promise<{
  processed: boolean;
  jobId?: string;
  jobVersion?: number;
  queueType?: 'rework' | 'backlog';
}> {
  const { agentId } = params;

  // Step 1: Preprocess
  const result = await preprocessActivity({ agentId });

  // Step 2: Process
  if (result.jobId && result.jobVersion && result.queueType && result.orgId) {
    try {
      // Start the child workflow in fire-and-forget mode
      // The child continues running independently even after this parent completes
      await executeChild(jobExecutionWorkflow, {
        args: [
          {
            jobId: result.jobId,
            jobVersion: result.jobVersion,
            orgId: result.orgId,
            queueType: result.queueType,
            agentId,
          },
        ],
        workflowId: `job-execution-${result.jobId}-v${result.jobVersion}`,
        workflowExecutionTimeout: '2 hours',
        workflowRunTimeout: '1 hour',
        // ABANDON policy: child workflow continues even if parent completes or fails
        // This prevents parent timeout from affecting long-running job execution
        parentClosePolicy: ParentClosePolicy.ABANDON,
      });
      return {
        processed: true,
        jobId: result.jobId,
        jobVersion: result.jobVersion,
        queueType: result.queueType,
      };
    } catch {
      // Only catches workflow START failures, not execution failures
      // Execution failures are handled by the child workflow's finally block
      return {
        processed: false,
        jobId: result.jobId,
        jobVersion: result.jobVersion,
        queueType: result.queueType,
      };
    }
  }

  return { processed: false };
}

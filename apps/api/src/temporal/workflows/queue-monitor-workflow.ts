import { proxyActivities, executeChild } from '@temporalio/workflow';
import type * as activities from '../activities';
import { jobExecutionWorkflow } from './job-execution-workflow';

const {
  claimNextJobFromQueue,
  isQueuePaused,
  getAgent,
  hasAgentInProgressJob,
  detectStuckJobs,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
  retry: {
    initialInterval: '1s',
    maximumAttempts: 3,
  },
});

/**
 * Queue Monitor Workflow
 * 
 * This workflow is triggered by a Temporal Schedule periodically (e.g., every 30 seconds).
 * Each agent has one schedule that monitors both queues and picks up tasks.
 * 
 * Priority: Checks rework queue first, then backlog queue
 * 
 * Conditions for processing:
 * 1. Agent is active
 * 2. Queue is not paused
 * 3. Agent doesn't have a job currently in-progress
 * 4. There's at least one job in the queue
 * 
 * This approach is better for horizontal scaling as:
 * - No long-running workflows with while loops
 * - Each execution is independent and can run on any worker
 * - Temporal Schedules handle the periodic triggering
 * - Each agent monitors queues independently
 */
export async function queueMonitorWorkflow(params: {
  agentId: string;
}): Promise<{ processed: boolean; jobId?: string; queueType?: 'rework' | 'backlog' }> {
  const { agentId } = params;

  // Get agent info to get orgId and check status
  const agent = await getAgent({ agentId });
  if (!agent || agent.status !== 'active') {
    return { processed: false };
  }

  const orgId = agent.orgId;

  // First, check for and handle any stuck jobs for this agent's org
  // This acts as a safety net for jobs that got stuck due to agent death or workflow failures
  await detectStuckJobs({ orgId });

  // Check if this agent already has a job in progress
  const hasInProgressRework = await hasAgentInProgressJob({ agentId, queueType: 'rework' });
  const hasInProgressBacklog = await hasAgentInProgressJob({ agentId, queueType: 'backlog' });
  if (hasInProgressRework || hasInProgressBacklog) {
    return { processed: false };
  }

  // Check queues in priority order: rework first, then backlog
  // This ensures rework jobs are always processed before backlog jobs
  const queueTypes: Array<'rework' | 'backlog'> = ['rework', 'backlog'];
  
  for (const queueType of queueTypes) {
    // Check if queue is paused
    const paused = await isQueuePaused({ orgId, queueType });
    if (paused) {
      continue; // Skip this queue, try next one
    }

    // Atomically claim the next job from queue
    // This ensures only one agent can claim a job, preventing race conditions
    const claimedJob = await claimNextJobFromQueue({ orgId, queueType });
    if (!claimedJob) {
      continue; // No jobs in this queue, try next one
    }

    // Execute the job via child workflow, assigned to this agent
    // The job has already been removed from the queue and marked as in-progress
    try {
      await executeChild(jobExecutionWorkflow, {
        args: [{
          jobId: claimedJob.jobId,
          orgId,
          queueType,
          agentId, // Assign job to this agent
        }],
        workflowId: `job-execution-${claimedJob.jobId}`,
        workflowExecutionTimeout: '2 hours', // Long timeout for job execution
        workflowRunTimeout: '1 hour', // Individual run timeout
      });
      return { processed: true, jobId: claimedJob.jobId, queueType };
    } catch {
      // Job failed, error already handled in jobExecutionWorkflow
      return { processed: false, jobId: claimedJob.jobId, queueType };
    }
  }

  // No jobs found in either queue
  return { processed: false };
}


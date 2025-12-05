import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const {
  pingAgentViaStream,
  getAgent,
  updateAgentStatus,
  pauseAgentSchedules,
  pauseHealthCheckSchedule,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '15 seconds',
  retry: {
    initialInterval: '1s',
    maximumAttempts: 1,
  },
});

export async function agentHealthCheckWorkflow(params: {
  agentId: string;
}): Promise<{ success: boolean }> {
  const { agentId } = params;

  const agent = await getAgent({ agentId });
  if (!agent || agent.status !== 'active') {
    return { success: false };
  }

  const pingResult = await pingAgentViaStream({ agentId });

  if (pingResult.success) {
    await updateAgentStatus({
      agentId,
      consecutiveFailures: 0,
    });
    return { success: true };
  } else {
    const newFailureCount = (agent.consecutiveFailures || 0) + 1;
    await updateAgentStatus({
      agentId,
      consecutiveFailures: newFailureCount,
    });

    if (newFailureCount >= 3) {
      await updateAgentStatus({
        agentId,
        status: 'offline',
      });

      // Pause schedules via activities (workflows cannot use Temporal client directly)
      await pauseAgentSchedules({ agentId });
      await pauseHealthCheckSchedule({ agentId });
    }

    return { success: false };
  }
}


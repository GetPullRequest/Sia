import { agentStreamManager } from '../../services/agent-stream-manager';
import { BackendStreamMessageType } from '@sia/models/proto';
import { db, schema } from '../../db/index';
import { eq } from 'drizzle-orm';
import { queueWorkflowService } from '../../services/queue-workflow-service';

export async function pingAgentViaStream(params: {
  agentId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { agentId } = params;

  const agent = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.id, agentId))
    .limit(1);

  if (!agent[0]) {
    try {
      await queueWorkflowService.pauseHealthCheckSchedule(agentId);
    } catch (error) {
      console.error(`Failed to pause health check schedule for agent ${agentId}:`, error);
    }
    return { success: false, error: 'Agent not found' };
  }

  const stream = agentStreamManager.getStream(agentId);
  if (!stream) {
    return { success: false, error: 'Agent stream not connected' };
  }

  try {
    const pingTimestamp = Date.now();
    const pingSent = await agentStreamManager.sendMessage(
      agentId,
      BackendStreamMessageType.HEALTH_CHECK_PING,
      { timestamp: pingTimestamp }
    );

    if (!pingSent) {
      return { success: false, error: 'Failed to send ping' };
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const updatedAgent = await db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.id, agentId))
      .limit(1);

    if (!updatedAgent[0]) {
      return { success: false, error: 'Agent not found' };
    }

    const lastActive = updatedAgent[0].lastActive?.getTime() || 0;
    const timeSinceLastActive = Date.now() - lastActive;

    if (timeSinceLastActive < 10000 && updatedAgent[0].lastActive && updatedAgent[0].lastActive.getTime() >= pingTimestamp) {
      return { success: true };
    } else {
      return { success: false, error: 'No heartbeat received within timeout' };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}


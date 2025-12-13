import { db, schema } from '../../db/index';
import { eq } from 'drizzle-orm';
import { AgentClient } from '../../services/agent-client';

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
    return { success: false, error: 'Agent not found' };
  }

  const agentRecord = agent[0];

  // Get agent connection details
  const host = agentRecord.host || agentRecord.ip || 'localhost';
  const port = agentRecord.port || 50051;
  const agentAddress = `${host}:${port}`;

  // Create a stateless connection to ping the agent
  const agentClient = new AgentClient(agentAddress);

  try {
    // Attempt to ping the agent via gRPC health check
    const response = await Promise.race([
      agentClient.healthCheck(agentId),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                'Unable to establish the connection. Please check if the agent is running in the host machine and its reachable.'
              )
            ),
          10000
        )
      ),
    ]);

    if (response.success) {
      // Update lastActive timestamp and set status to active on successful ping
      await db
        .update(schema.agents)
        .set({
          status: 'active',
          lastActive: new Date(),
          consecutiveFailures: 0,
          updatedAt: new Date(),
        })
        .where(eq(schema.agents.id, agentId));

      return { success: true };
    } else {
      // Health check returned unsuccessful - mark as offline
      await db
        .update(schema.agents)
        .set({
          status: 'offline',
          consecutiveFailures: (agentRecord.consecutiveFailures || 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(schema.agents.id, agentId));

      return {
        success: false,
        error:
          'Unable to establish the connection. Please check if the agent is running in the host machine and its reachable.',
      };
    }
  } catch (error) {
    // Update consecutive failures and mark as offline on error
    await db
      .update(schema.agents)
      .set({
        status: 'offline',
        consecutiveFailures: (agentRecord.consecutiveFailures || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(schema.agents.id, agentId));

    return {
      success: false,
      error:
        'Unable to establish the connection. Please check if the agent is running in the host machine and its reachable.',
    };
  } finally {
    // Close the stateless connection
    agentClient.close();
  }
}

import { db, schema } from '../../db/index';
import { eq } from 'drizzle-orm';

export async function updateAgentStatus(params: {
  agentId: string;
  status?: 'active' | 'idle' | 'offline';
  consecutiveFailures?: number;
}): Promise<void> {
  const { agentId, status, consecutiveFailures } = params;

  const updateData: Partial<typeof schema.agents.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (status !== undefined) {
    updateData.status = status;
  }

  if (consecutiveFailures !== undefined) {
    updateData.consecutiveFailures = consecutiveFailures;
  }

  await db
    .update(schema.agents)
    .set(updateData)
    .where(eq(schema.agents.id, agentId));
}


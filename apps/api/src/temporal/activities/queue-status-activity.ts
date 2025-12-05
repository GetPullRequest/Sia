import { db, schema } from '../../db/index';
import { eq, and } from 'drizzle-orm';

/**
 * Check if there are any in-progress jobs for the given org and queue type
 */
export async function hasInProgressJobs(params: {
  orgId: string;
  queueType: 'rework' | 'backlog';
}): Promise<boolean> {
  const jobs = await db
    .select()
    .from(schema.jobs)
    .where(and(
      eq(schema.jobs.orgId, params.orgId),
      eq(schema.jobs.status, 'in-progress'),
      eq(schema.jobs.queueType, params.queueType)
    ))
    .limit(1);
  
  return jobs.length > 0;
}

/**
 * Check if the queue is paused
 * Pause state is stored in the queue_states table
 */
export async function isQueuePaused(params: {
  orgId: string;
  queueType: 'rework' | 'backlog';
}): Promise<boolean> {
  try {
    const queueState = await db
      .select()
      .from(schema.queueStates)
      .where(and(
        eq(schema.queueStates.orgId, params.orgId),
        eq(schema.queueStates.queueType, params.queueType)
      ))
      .limit(1);
    
    if (queueState.length === 0) {
      // No pause state record means queue is not paused
      return false;
    }
    
    return queueState[0].isPaused;
  } catch (error) {
    // If table doesn't exist yet or error, assume not paused
    console.error('Error checking queue pause state:', error);
    return false;
  }
}

/**
 * Set pause state for a queue
 */
export async function setQueuePaused(params: {
  orgId: string;
  queueType: 'rework' | 'backlog';
  isPaused: boolean;
}): Promise<void> {
  try {
    await db
      .insert(schema.queueStates)
      .values({
        orgId: params.orgId,
        queueType: params.queueType,
        isPaused: params.isPaused,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.queueStates.orgId, schema.queueStates.queueType],
        set: {
          isPaused: params.isPaused,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Error setting queue pause state:', error);
    throw error;
  }
}

/**
 * Get agent information
 */
export async function getAgent(params: {
  agentId: string;
}): Promise<{
  id: string;
  orgId: string;
  status: string;
  host: string;
  port: number;
  consecutiveFailures: number;
} | null> {
  const agent = await db
    .select({
      id: schema.agents.id,
      orgId: schema.agents.orgId,
      status: schema.agents.status,
      host: schema.agents.host,
      port: schema.agents.port,
      consecutiveFailures: schema.agents.consecutiveFailures,
    })
    .from(schema.agents)
    .where(eq(schema.agents.id, params.agentId))
    .limit(1);
  
  if (agent.length === 0) {
    return null;
  }
  
  return {
    id: agent[0].id,
    orgId: agent[0].orgId,
    status: agent[0].status,
    host: agent[0].host || 'localhost', // Default to localhost if not set
    port: agent[0].port || 50051, // Default to 50051 if not set
    consecutiveFailures: agent[0].consecutiveFailures || 0,
  };
}

/**
 * Check if agent has any in-progress jobs for the given queue type
 * Note: This assumes jobs table will have agentId field, or we track it separately
 * For now, we'll check if there are any in-progress jobs for the agent's org/queueType
 * and assume only one agent processes at a time per org/queueType
 */
export async function hasAgentInProgressJob(params: {
  agentId: string;
  queueType: 'rework' | 'backlog';
}): Promise<boolean> {
  // Get agent to find orgId
  const agent = await getAgent({ agentId: params.agentId });
  if (!agent) {
    return false;
  }

  // Check if there are any in-progress jobs for this org/queueType
  // In the future, we might add agentId to jobs table to track which agent is processing
  const jobs = await db
    .select()
    .from(schema.jobs)
    .where(and(
      eq(schema.jobs.orgId, agent.orgId),
      eq(schema.jobs.status, 'in-progress'),
      eq(schema.jobs.queueType, params.queueType)
    ))
    .limit(1);
  
  return jobs.length > 0;
}


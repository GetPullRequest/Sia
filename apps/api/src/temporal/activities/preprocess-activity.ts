import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq, and, or, lt, asc } from 'drizzle-orm';
import { agentStreamManager } from '../../services/agent-stream-manager';
import { BackendStreamMessageType } from '@sia/models';
import { AgentClient } from '../../services/agent-client';
import { queueWorkflowService } from '../../services/queue-workflow-service';

export async function preprocessActivity(params: { agentId: string }): Promise<{
  jobId: string | null;
  queueType: 'rework' | 'backlog' | null;
  orgId: string | null;
}> {
  const { agentId } = params;

  // Get agent info
  const agents = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.id, agentId))
    .limit(1);

  const agent = agents[0];
  const orgId = agent.orgId;

  // Send heartbeat on every schedule execution
  // First try via stream (if connection exists on this machine)
  let healthCheckSuccess = await agentStreamManager.sendMessage(
    agentId,
    BackendStreamMessageType.HEALTH_CHECK_PING,
    { timestamp: Date.now() }
  );

  // If stream send failed, try direct gRPC call as fallback
  if (!healthCheckSuccess) {
    try {
      const host = agent.host || agent.ip || 'localhost';
      const port = agent.port || 50051;
      const agentAddress = `${host}:${port}`;
      const agentClient = new AgentClient(agentAddress);

      const healthCheckResponse = await Promise.race([
        agentClient.healthCheck(agentId),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), 5000)
        ),
      ]);

      if (healthCheckResponse.success) {
        healthCheckSuccess = true;
      }

      agentClient.close();
    } catch (error) {
      console.warn(
        `Failed to send health check via direct gRPC for agent ${agentId}:`,
        error
      );
    }
  }

  // Update agent status based on health check result
  if (healthCheckSuccess) {
    await db
      .update(schema.agents)
      .set({
        lastActive: new Date(),
        consecutiveFailures: 0,
        updatedAt: new Date(),
      })
      .where(eq(schema.agents.id, agentId));
  } else {
    // Health check failed - increment consecutive failures
    const newConsecutiveFailures = (agent.consecutiveFailures || 0) + 1;

    await db
      .update(schema.agents)
      .set({
        status: 'offline',
        consecutiveFailures: newConsecutiveFailures,
        updatedAt: new Date(),
      })
      .where(eq(schema.agents.id, agentId));

    // If we've reached 5 consecutive failures, pause the schedule
    if (newConsecutiveFailures >= 5) {
      try {
        await queueWorkflowService.pauseAgentSchedules(agentId);
        console.log(
          `Paused schedule for agent ${agentId} after ${newConsecutiveFailures} consecutive health check failures`
        );
      } catch (error) {
        console.error(`Failed to pause schedule for agent ${agentId}:`, error);
      }
    }

    // Return early since agent is offline
    return { jobId: null, queueType: null, orgId: null };
  }

  // 1. Check for orphan jobs (stuck jobs)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const orphanJobs = await db
    .select()
    .from(schema.jobs)
    .where(
      and(
        eq(schema.jobs.orgId, orgId),
        eq(schema.jobs.status, 'in-progress'),
        or(
          eq(schema.jobs.agentId, agentId),
          lt(schema.jobs.updatedAt, fiveMinutesAgo)
        )
      )
    );

  for (const job of orphanJobs) {
    await db
      .update(schema.jobs)
      .set({
        status: 'queued',
        agentId: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.jobs.id, job.id));
  }

  // 2. Check if agent has job in progress
  const inProgressJobs = await db
    .select()
    .from(schema.jobs)
    .where(
      and(
        eq(schema.jobs.agentId, agentId),
        eq(schema.jobs.status, 'in-progress')
      )
    )
    .limit(1);

  if (inProgressJobs.length > 0) {
    return { jobId: null, queueType: null, orgId };
  }

  // 3. Check if queues are paused
  const queueTypes: Array<'rework' | 'backlog'> = ['rework', 'backlog'];

  for (const queueType of queueTypes) {
    const queueState = await db
      .select()
      .from(schema.queueStates)
      .where(
        and(
          eq(schema.queueStates.orgId, orgId),
          eq(schema.queueStates.queueType, queueType)
        )
      )
      .limit(1);

    if (queueState.length > 0 && queueState[0].isPaused) {
      continue;
    }

    // Get lowest priority job (lowest orderInQueue value)
    const nextJobs = await db
      .select()
      .from(schema.jobs)
      .where(
        and(
          eq(schema.jobs.orgId, orgId),
          eq(schema.jobs.status, 'queued'),
          eq(schema.jobs.queueType, queueType)
        )
      )
      .orderBy(asc(schema.jobs.orderInQueue))
      .limit(1);

    if (nextJobs.length > 0) {
      const nextJob = nextJobs[0];
      // Claim the job
      await db
        .update(schema.jobs)
        .set({
          status: 'in-progress',
          agentId,
          updatedAt: new Date(),
        })
        .where(eq(schema.jobs.id, nextJob.id));

      return { jobId: nextJob.id, queueType, orgId };
    }
  }

  return { jobId: null, queueType: null, orgId };
}

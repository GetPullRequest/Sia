import { db } from '../../db/index.js';
import * as schema from '../../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { agentStreamManager } from '../../services/agent-stream-manager.js';
import { BackendStreamMessageType, type LogMessage } from '@sia/models/proto';
import { AgentClient } from '../../services/agent-client.js';
import { queueWorkflowService } from '../../services/queue-workflow-service.js';
import { createTemporalClient } from '../client.js';
import { logStorage } from '../../services/log-storage.js';

type JobRow = typeof schema.jobs.$inferSelect;

async function handleOrphanJobsForRows(
  orgId: string,
  jobs: JobRow[]
): Promise<void> {
  if (!jobs.length) return;

  let temporalClient: Awaited<ReturnType<typeof createTemporalClient>> | null =
    null;

  try {
    temporalClient = await createTemporalClient();
  } catch (error) {
    console.error(
      'Failed to create Temporal client for orphan detection:',
      error
    );
  }

  for (const job of jobs) {
    let workflowActive = false;

    if (temporalClient) {
      const workflowId = `job-execution-${job.id}-v${job.version}`;
      try {
        const handle = temporalClient.workflow.getHandle(workflowId);
        const description = await handle.describe();
        const status =
          // Newer Temporal client returns an enum-like object with name
          (description.status as any)?.name ?? description.status;

        if (status === 'RUNNING') {
          workflowActive = true;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          !message.includes('not found') &&
          !message.includes('NotFound') &&
          !message.includes('NOT_FOUND')
        ) {
          console.error(
            `Failed to describe workflow job-execution-${job.id}-v${job.version} for job ${job.id}:`,
            error
          );
        }
        // NotFound means workflow is not active, which is treated as orphan
      }
    }

    // If workflow is still active, skip this job
    if (workflowActive) {
      continue;
    }

    // Mark current version as failed and log internal error
    const now = new Date();
    const errorMessage =
      'Internal error: job workflow does not exist in Temporal. Marking this version as failed and retrying with a new version.';

    await db
      .update(schema.jobs)
      .set({
        status: 'failed',
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.jobs.id, job.id),
          eq(schema.jobs.version, job.version),
          eq(schema.jobs.orgId, orgId)
        )
      );

    // Add a workflow-stage error log for the failed version
    try {
      const log: LogMessage = {
        level: 'error',
        message: errorMessage,
        jobId: job.id,
        stage: 'workflow',
        timestamp: now.toISOString(),
      };
      await logStorage.addLog(job.id, job.version, orgId, log);
    } catch (error) {
      console.error(
        'Failed to append orphan-detection log for job',
        job.id,
        error
      );
    }

    // Create a new job version and push it to the rework queue
    // Only count latest versions of each job
    const reworkQueueJobsResult = await db.execute(sql`
      SELECT DISTINCT ON (id)
        id
      FROM ${schema.jobs}
      WHERE org_id = ${orgId}
        AND status = 'queued'
        AND queue_type = 'rework'
      ORDER BY id, version DESC
    `);

    const nextOrderInQueue = reworkQueueJobsResult.rows.length;
    const newVersion = job.version + 1;

    await db.insert(schema.jobs).values({
      id: job.id,
      version: newVersion,
      orgId: job.orgId,
      generatedName: job.generatedName,
      generatedDescription: job.generatedDescription,
      status: 'queued',
      priority: job.priority,
      orderInQueue: nextOrderInQueue,
      queueType: 'rework',
      agentId: null,
      createdAt: now,
      updatedAt: now,
      createdBy: job.createdBy,
      updatedBy: job.updatedBy,
      codeGenerationLogs: null,
      codeVerificationLogs: null,
      codeGenerationDetailLogs: null,
      userInput: job.userInput,
      repos: job.repos,
      userAcceptanceStatus: job.userAcceptanceStatus,
      userComments: job.userComments,
      confidenceScore: job.confidenceScore,
      prLink: null,
      updates: `Previous job version ${
        job.version
      } failed due to internal error (workflow not found) at ${now.toLocaleString()}. New version ${newVersion} queued in rework queue for retry.`,
    });
  }
}

export async function preprocessActivity(params: { agentId: string }): Promise<{
  jobId: string | null;
  jobVersion: number | null;
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

    // If this was the last active agent for the org, check for in-progress jobs
    // that no longer have an active Temporal workflow and handle them as orphans.
    const activeAgents = await db
      .select()
      .from(schema.agents)
      .where(
        and(eq(schema.agents.orgId, orgId), eq(schema.agents.status, 'active'))
      )
      .limit(1);

    if (activeAgents.length === 0) {
      // Get only the latest version of each in-progress job
      // DISTINCT ON (id) with ORDER BY id, version DESC ensures one row per job (latest version)
      const latestInProgressJobsResult = await db.execute(sql`
        SELECT DISTINCT ON (id)
          *
        FROM ${schema.jobs}
        WHERE org_id = ${orgId}
          AND status = 'in-progress'
        ORDER BY id, version DESC
      `);

      await handleOrphanJobsForRows(
        orgId,
        latestInProgressJobsResult.rows as JobRow[]
      );
    }

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
    return { jobId: null, jobVersion: null, queueType: null, orgId: null };
  }

  // 1. Check for orphan jobs (stuck jobs where the Temporal workflow is no longer running)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const potentialOrphanJobsResult = await db.execute(sql`
    SELECT DISTINCT ON (id)
      *
    FROM ${schema.jobs}
    WHERE org_id = ${orgId}
      AND status = 'in-progress'
      AND (
        agent_id = ${agentId}
        OR updated_at < ${fiveMinutesAgo.toISOString()}
      )
    ORDER BY id, version DESC
  `);
  await handleOrphanJobsForRows(
    orgId,
    potentialOrphanJobsResult.rows as JobRow[]
  );

  // 2. Check if agent has job in progress
  const agentInProgressJobsResult = await db.execute(sql`
    SELECT DISTINCT ON (id)
      id
    FROM ${schema.jobs}
    WHERE agent_id = ${agentId}
      AND status = 'in-progress'
    ORDER BY id, version DESC
    LIMIT 1
  `);

  if (agentInProgressJobsResult.rows.length > 0) {
    return { jobId: null, jobVersion: null, queueType: null, orgId };
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

    // Get the next job from this queue:
    // Step 1: Find the latest version for each job id (subquery with MAX(version))
    // Step 2: Join to get only the rows with those latest versions
    // Step 3: Order by order_in_queue of those latest versions only
    // Step 4: Take the one with lowest order_in_queue
    // This ensures we never process old versions, even if they have lower order_in_queue values
    const latestQueuedJobsResult = await db.execute<{
      id: string;
      version: number;
      order_in_queue: number;
    }>(sql`
      SELECT j.id, j.version, j.order_in_queue
      FROM ${schema.jobs} j
      INNER JOIN (
        -- Get only the latest version for each job id
        SELECT id, MAX(version) as max_version
        FROM ${schema.jobs}
        WHERE org_id = ${orgId}
          AND status = 'queued'
          AND queue_type = ${queueType}
        GROUP BY id
      ) latest ON j.id = latest.id AND j.version = latest.max_version
      WHERE j.org_id = ${orgId}
        AND j.status = 'queued'
        AND j.queue_type = ${queueType}
      -- Order by order_in_queue, but only considering latest versions
      ORDER BY j.order_in_queue ASC
      LIMIT 1
    `);

    const nextJobRow = latestQueuedJobsResult.rows[0];

    if (nextJobRow) {
      // Double-check that this is indeed the latest version before claiming
      const verifyLatestResult = await db.execute<{ version: number }>(sql`
        SELECT MAX(version) as version
        FROM ${schema.jobs}
        WHERE id = ${nextJobRow.id}
          AND org_id = ${orgId}
          AND status = 'queued'
          AND queue_type = ${queueType}
      `);

      const maxVersion = verifyLatestResult.rows[0]?.version;
      if (maxVersion && nextJobRow.version !== maxVersion) {
        console.error(
          `[preprocess-activity] Race condition detected: Attempted to claim job ${nextJobRow.id} v${nextJobRow.version}, but latest queued version is v${maxVersion}. Skipping.`
        );
        continue; // Skip this job and try the next queue
      }

      // Claim the job (update the specific version)
      const updateResult = await db
        .update(schema.jobs)
        .set({
          status: 'in-progress',
          agentId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.jobs.id, nextJobRow.id),
            eq(schema.jobs.version, nextJobRow.version),
            eq(schema.jobs.status, 'queued'),
            eq(schema.jobs.orgId, orgId)
          )
        )
        .returning({ id: schema.jobs.id, version: schema.jobs.version });

      // If no rows were updated, it means the job was already claimed or status changed
      if (updateResult.length === 0) {
        console.warn(
          `[preprocess-activity] Failed to claim job ${nextJobRow.id} v${nextJobRow.version} - may have been claimed by another process`
        );
        continue; // Try next queue
      }

      return {
        jobId: nextJobRow.id,
        jobVersion: nextJobRow.version,
        queueType,
        orgId,
      };
    }
  }

  return { jobId: null, jobVersion: null, queueType: null, orgId };
}

import { AgentClient } from '../../services/agent-client';
import { logStorage } from '../../services/log-storage';
import { websocketManager } from '../../services/websocket-manager';
import { db, schema } from '../../db/index';
import { eq, and, desc } from 'drizzle-orm';
import type { LogMessage } from '@sia/models/proto';

export async function sendCommandToAgent(params: {
  jobId: string;
  orgId: string;
  command:
    | 'startExecution'
    | 'waitForCompletion'
    | 'runVerification'
    | 'createPR'
    | 'cleanup';
  payload?: any;
}): Promise<any> {
  const { jobId, orgId, command, payload } = params;

  // Get job version first - we'll use this for all logging
  const jobVersionResult = await db
    .select({ version: schema.jobs.version })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.orgId, orgId)))
    .orderBy(desc(schema.jobs.version))
    .limit(1);

  const jobVersion = jobVersionResult[0]?.version || 1;

  // Log activity input
  await logStorage.addLog(jobId, jobVersion, orgId, {
    level: 'info',
    message: `[Activity] sendCommandToAgent started. Command: ${command}, Input: ${JSON.stringify(
      {
        command,
        payload: {
          ...payload,
          gitCredentials: payload?.gitCredentials ? '[REDACTED]' : undefined,
          vibeCoderCredentials: payload?.vibeCoderCredentials
            ? '[REDACTED]'
            : undefined,
        },
      },
      null,
      2
    )}`,
    timestamp: new Date().toISOString(),
    jobId,
    stage: 'agent-activity',
  });

  // Use agentId from payload to connect to specific agent
  const agentId = payload?.agentId;
  let agentClient: AgentClient;
  let agentAddress: string;

  // Log the command being executed
  await logStorage.addLog(jobId, jobVersion, orgId, {
    level: 'info',
    message: `[Activity] Executing command: ${command} for job ${jobId}`,
    timestamp: new Date().toISOString(),
    jobId,
    stage: 'agent-activity',
  });

  if (agentId) {
    await logStorage.addLog(jobId, jobVersion, orgId, {
      level: 'info',
      message: `[Activity] Looking up agent configuration for agentId=${agentId}`,
      timestamp: new Date().toISOString(),
      jobId,
      stage: 'agent-activity',
    });

    const agent = await db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.id, agentId))
      .limit(1);
    if (!agent[0]) {
      await logStorage.addLog(jobId, jobVersion, orgId, {
        level: 'error',
        message: `[Activity] Agent ${agentId} not found in database`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'agent-activity',
      });
      throw new Error(`Agent ${agentId} not found`);
    }
    const host = agent[0].host || 'localhost';
    const port = agent[0].port || 50051;
    agentAddress = `${host}:${port}`;

    await logStorage.addLog(jobId, jobVersion, orgId, {
      level: 'info',
      message: `[Activity] Agent found: name=${
        agent[0].name || 'unnamed'
      }, connecting to ${agentAddress}`,
      timestamp: new Date().toISOString(),
      jobId,
      stage: 'agent-activity',
    });

    agentClient = new AgentClient(agentAddress);
  } else {
    // Fallback to default if no agentId specified
    agentAddress = process.env.AGENT_SERVER_ADDRESS || 'localhost:50051';
    await logStorage.addLog(jobId, jobVersion, orgId, {
      level: 'info',
      message: `[Activity] No agentId specified, using default agent at ${agentAddress}`,
      timestamp: new Date().toISOString(),
      jobId,
      stage: 'agent-activity',
    });
    agentClient = new AgentClient();
  }

  await logStorage.addLog(jobId, jobVersion, orgId, {
    level: 'info',
    message: `[Activity] Attempting gRPC connection to agent at ${agentAddress}`,
    timestamp: new Date().toISOString(),
    jobId,
    stage: 'agent-activity',
  });

  try {
    switch (command) {
      case 'startExecution': {
        await logStorage.addLog(jobId, jobVersion, orgId, {
          level: 'info',
          message: `[Activity] Processing startExecution command`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'agent-activity',
        });

        // Get job details (we already have version, but need full job)
        const jobResult = await db
          .select()
          .from(schema.jobs)
          .where(
            and(
              eq(schema.jobs.id, jobId),
              eq(schema.jobs.orgId, orgId),
              eq(schema.jobs.version, jobVersion)
            )
          )
          .limit(1);

        if (!jobResult[0]) {
          await logStorage.addLog(jobId, jobVersion, orgId, {
            level: 'error',
            message: `[Activity] Job ${jobId} version ${jobVersion} not found in database for org ${orgId}`,
            timestamp: new Date().toISOString(),
            jobId,
            stage: 'agent-activity',
          });
          throw new Error(`Job ${jobId} version ${jobVersion} not found`);
        }

        const job = jobResult[0];

        await logStorage.addLog(jobId, job.version, orgId, {
          level: 'info',
          message: `[Activity] Job found: version=${job.version}, status=${job.status}`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'agent-activity',
        });

        // Update status to in-progress
        await db
          .update(schema.jobs)
          .set({
            status: 'in-progress',
            updatedAt: new Date(),
          })
          .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.orgId, orgId)));

        await logStorage.addLog(jobId, job.version, orgId, {
          level: 'info',
          message: `[Activity] Job status updated to in-progress`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'agent-activity',
        });

        await logStorage.addLog(jobId, job.version, orgId, {
          level: 'info',
          message: `[Activity] Invoking agent.executeJob via gRPC - repos=${
            payload.repos
              ? payload.repos
                  .map((r: { repoId: string }) => r.repoId)
                  .join(', ')
              : 'none'
          }, prompt length=${payload.prompt?.length || 0} chars`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'agent-activity',
        });

        // Agent: Clone repo, start cursor, execute task
        await agentClient.executeJob({
          jobId,
          prompt: payload.prompt,
          repos: payload.repos?.map((r: { repoId: string }) => r.repoId),
          jobDetails: {
            ...payload.gitCredentials,
            ...payload.vibeCoderCredentials,
          },
          onLog: async (log: LogMessage) => {
            // Handle streaming logs
            await logStorage.addLog(jobId, job.version, orgId, log);

            if (websocketManager.hasSubscribers(jobId)) {
              websocketManager.broadcast(jobId, {
                type: 'log',
                data: log,
              });
            }
          },
        });

        await logStorage.addLog(jobId, job.version, orgId, {
          level: 'info',
          message: `[Activity] agent.executeJob completed successfully`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'agent-activity',
        });

        return { success: true };
      }

      case 'waitForCompletion': {
        // Execution is already complete from startExecution
        // This is just a placeholder for workflow clarity
        await logStorage.addLog(jobId, jobVersion, orgId, {
          level: 'info',
          message: `[Activity] waitForCompletion - execution already complete from startExecution`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'agent-activity',
        });
        const waitResult = { success: true, completed: true };
        await logStorage.addLog(jobId, jobVersion, orgId, {
          level: 'info',
          message: `[Activity] waitForCompletion completed. Output: ${JSON.stringify(
            waitResult,
            null,
            2
          )}`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'agent-activity',
        });
        return waitResult;
      }

      case 'runVerification': {
        await logStorage.addLog(jobId, jobVersion, orgId, {
          level: 'info',
          message: `[Activity] Invoking agent.runVerification via gRPC`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'agent-activity',
        });
        // Agent: Run verification on agent machine
        const verificationResult = await agentClient.runVerification(jobId);
        await logStorage.addLog(jobId, jobVersion, orgId, {
          level: 'info',
          message: `[Activity] Verification completed. Output: ${JSON.stringify(
            verificationResult,
            null,
            2
          )}`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'agent-activity',
        });
        return verificationResult;
      }

      case 'createPR': {
        await logStorage.addLog(jobId, jobVersion, orgId, {
          level: 'info',
          message: `[Activity] Invoking agent.createPR via gRPC - repoId=${payload.repoId}, branchName=${payload.branchName}`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'agent-activity',
        });
        // Agent: Create PR on agent machine
        const prResult = await agentClient.createPR({
          jobId,
          repoId: payload.repoId,
          branchName: payload.branchName,
          title: `Auto-generated PR for job ${jobId}`,
          body: `This PR was automatically generated by Sia for job ${jobId}`,
        });
        await logStorage.addLog(jobId, jobVersion, orgId, {
          level: 'info',
          message: `[Activity] PR creation completed. Output: ${JSON.stringify(
            prResult,
            null,
            2
          )}`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'agent-activity',
        });
        return prResult;
      }

      case 'cleanup': {
        await logStorage.addLog(jobId, jobVersion, orgId, {
          level: 'info',
          message: `[Activity] Invoking agent.cleanupWorkspace via gRPC`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'agent-activity',
        });
        // Agent: Cleanup workspace on agent machine
        const cleanupResult = await agentClient.cleanupWorkspace(jobId);
        await logStorage.addLog(jobId, jobVersion, orgId, {
          level: 'info',
          message: `[Activity] Cleanup completed. Output: ${JSON.stringify(
            cleanupResult,
            null,
            2
          )}`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'agent-activity',
        });
        return cleanupResult;
      }

      default:
        await logStorage.addLog(jobId, jobVersion, orgId, {
          level: 'error',
          message: `[Activity] Unknown command received: ${command}`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'agent-activity',
        });
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : 'N/A';
    await logStorage.addLog(jobId, jobVersion, orgId, {
      level: 'error',
      message: `[Activity] Command ${command} failed. Error: ${errorMsg}. Stack: ${errorStack}`,
      timestamp: new Date().toISOString(),
      jobId,
      stage: 'agent-activity',
    });
    throw error;
  } finally {
    await logStorage.addLog(jobId, jobVersion, orgId, {
      level: 'info',
      message: `[Activity] Closing gRPC connection to agent`,
      timestamp: new Date().toISOString(),
      jobId,
      stage: 'agent-activity',
    });
    agentClient.close();
  }
}

import { AgentClient } from '../../services/agent-client.js';
import { logStorage } from '../../services/log-storage.js';
import { websocketManager } from '../../services/websocket-manager.js';
import { db, schema } from '../../db/index.js';
import { eq, and } from 'drizzle-orm';
import type { LogMessage } from '@sia/models/proto';

export async function sendCommandToAgent(params: {
  jobId: string;
  jobVersion: number;
  orgId: string;
  command:
    | 'startExecution'
    | 'waitForCompletion'
    | 'runVerification'
    | 'createPR'
    | 'cleanup'
    | 'checkout'
    | 'setup'
    | 'build'
    | 'execute';
  payload?: any;
}): Promise<any> {
  const { jobId, jobVersion, orgId, command, payload } = params;

  // Local helper: log with just level and message
  const log = async (
    level: LogMessage['level'],
    message: string,
    stage = 'agent-activity'
  ) => {
    await logStorage.addLog(jobId, jobVersion, orgId, {
      level,
      message,
      timestamp: new Date().toISOString(),
      jobId,
      stage,
    });
  };

  // Log activity input
  await log(
    'info',
    `[Activity] sendCommandToAgent started. Command: ${command}`
  );

  // Use agentId from payload to connect to specific agent
  const agentId = payload?.agentId;
  let agentClient: AgentClient;
  let agentAddress: string;

  // Log the command being executed
  await log('info', `[Activity] Executing command: ${command}`);

  if (agentId) {
    await log(
      'info',
      `[Activity] Looking up agent configuration for agentId=${agentId}`
    );

    const agent = await db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.id, agentId))
      .limit(1);
    if (!agent[0]) {
      await log('error', `[Activity] Agent ${agentId} not found in database`);
      throw new Error(`Agent ${agentId} not found`);
    }
    const host = agent[0].host || 'localhost';
    const port = agent[0].port || 50051;
    agentAddress = `${host}:${port}`;

    await log(
      'info',
      `[Activity] Agent found: name=${
        agent[0].name || 'unnamed'
      }, connecting to ${agentAddress}`
    );

    agentClient = new AgentClient(agentAddress);
  } else {
    // Fallback to default if no agentId specified
    agentAddress = process.env.AGENT_SERVER_ADDRESS || 'localhost:50051';
    await log(
      'info',
      `[Activity] No agentId specified, using default agent at ${agentAddress}`
    );
    agentClient = new AgentClient();
  }

  await log(
    'info',
    `[Activity] Attempting gRPC connection to agent at ${agentAddress}`
  );

  try {
    switch (command) {
      case 'startExecution': {
        await log('info', `[Activity] Processing startExecution command`);

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
          await log(
            'error',
            `[Activity] Job ${jobId} version ${jobVersion} not found in database for org ${orgId}`
          );
          throw new Error(`Job ${jobId} version ${jobVersion} not found`);
        }

        const job = jobResult[0];

        await log(
          'info',
          `[Activity] Job found: version=${job.version}, status=${job.status}`
        );

        // Update status to in-progress
        await db
          .update(schema.jobs)
          .set({
            status: 'in-progress',
            updatedAt: new Date(),
          })
          .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.orgId, orgId)));

        await log('info', `[Activity] Job status updated to in-progress`);

        const repoCount = payload.repos ? payload.repos.length : 0;
        await log(
          'info',
          `[Activity] Invoking agent.executeJob via gRPC - ${repoCount} repos, prompt length=${
            payload.prompt?.length || 0
          } chars`
        );

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

        await log('info', `[Activity] agent.executeJob completed successfully`);

        return { success: true };
      }

      case 'waitForCompletion': {
        // Execution is already complete from startExecution
        // This is just a placeholder for workflow clarity
        await log(
          'info',
          `[Activity] waitForCompletion - execution already complete from startExecution`
        );
        const waitResult = { success: true, completed: true };
        await log('info', `[Activity] waitForCompletion completed`);
        return waitResult;
      }

      case 'runVerification': {
        await log('info', `[Activity] Invoking agent.runVerification via gRPC`);
        // Agent: Run verification on agent machine
        const verificationResult = await agentClient.runVerification(jobId);
        await log('info', `[Activity] Verification completed`);
        return verificationResult;
      }

      case 'createPR': {
        await log(
          'info',
          `[Activity] Invoking agent.createPR via gRPC - repoId=${payload.repoId}, branchName=${payload.branchName}`
        );
        // Agent: Create PR on agent machine
        const prResult = await agentClient.createPR({
          jobId,
          repoId: payload.repoId,
          branchName: payload.branchName,
          title: `Auto-generated PR for job ${jobId}`,
          body: `This PR was automatically generated by Sia for job ${jobId}`,
        });
        await log('info', `[Activity] PR creation completed`);
        return prResult;
      }

      case 'cleanup': {
        await log(
          'info',
          `[Activity] Invoking agent.cleanupWorkspace via gRPC`
        );
        // Agent: Cleanup workspace on agent machine
        const cleanupResult = await agentClient.cleanupWorkspace(jobId);
        await log('info', `[Activity] Cleanup completed`);
        return cleanupResult;
      }

      case 'checkout': {
        const repoCount = payload.repos ? payload.repos.length : 0;
        await log(
          'info',
          `[Activity] Processing checkout command for ${repoCount} repos`
        );

        // Agent: Clone repositories
        // Pass repos as JSON-encoded string in jobDetails since gRPC proto only supports single repoId
        await agentClient.executeJob({
          jobId,
          prompt: payload.prompt || '',
          repos: payload.repos?.map((r: { repoId: string }) => r.repoId),
          jobDetails: {
            ...payload.gitCredentials,
            ...payload.vibeCoderCredentials,
            step: 'checkout',
            // Encode repos array as JSON string
            reposJson: JSON.stringify(payload.repos || []),
          },
          onLog: async (log: LogMessage) => {
            await logStorage.addLog(jobId, jobVersion, orgId, log);
            if (websocketManager.hasSubscribers(jobId)) {
              websocketManager.broadcast(jobId, {
                type: 'log',
                data: log,
              });
            }
          },
        });

        await log('info', `[Activity] Checkout completed successfully`);

        return { success: true };
      }

      case 'setup': {
        await log('info', `[Activity] Processing setup command`);
        await log(
          'info',
          `[Activity] Invoking agent.executeJob via gRPC for setup`
        );

        // Agent: Run setup commands
        await agentClient.executeJob({
          jobId,
          prompt: payload.prompt || '',
          repos: payload.repos?.map((r: { repoId: string }) => r.repoId),
          jobDetails: {
            ...payload.gitCredentials,
            ...payload.vibeCoderCredentials,
            step: 'setup',
            setupCommands: payload.repos?.[0]?.setupCommands?.join(';') || '',
            reposJson: JSON.stringify(payload.repos || []),
          },
          onLog: async (log: LogMessage) => {
            await logStorage.addLog(jobId, jobVersion, orgId, log);
            if (websocketManager.hasSubscribers(jobId)) {
              websocketManager.broadcast(jobId, {
                type: 'log',
                data: log,
              });
            }
          },
        });

        await log('info', `[Activity] Setup completed successfully`);

        return { success: true };
      }

      case 'build': {
        await log('info', `[Activity] Processing build command`);
        await log(
          'info',
          `[Activity] Invoking agent.executeJob via gRPC for build`
        );

        // Agent: Run build commands
        await agentClient.executeJob({
          jobId,
          prompt: payload.prompt || '',
          repos: payload.repos?.map((r: { repoId: string }) => r.repoId),
          jobDetails: {
            ...payload.gitCredentials,
            ...payload.vibeCoderCredentials,
            step: 'build',
            buildCommands: payload.repos?.[0]?.buildCommands?.join(';') || '',
            reposJson: JSON.stringify(payload.repos || []),
          },
          onLog: async (log: LogMessage) => {
            await logStorage.addLog(jobId, jobVersion, orgId, log);
            if (websocketManager.hasSubscribers(jobId)) {
              websocketManager.broadcast(jobId, {
                type: 'log',
                data: log,
              });
            }
          },
        });

        await log('info', `[Activity] Build completed successfully`);

        return { success: true };
      }

      case 'execute': {
        await log('info', `[Activity] Processing execute command`);
        await log(
          'info',
          `[Activity] Invoking agent.executeJob via gRPC for execute - prompt length=${
            payload.prompt?.length || 0
          } chars`
        );

        // Agent: Execute code generation task
        await agentClient.executeJob({
          jobId,
          prompt: payload.prompt || '',
          repos: payload.repos?.map((r: { repoId: string }) => r.repoId),
          jobDetails: {
            ...payload.gitCredentials,
            ...payload.vibeCoderCredentials,
            step: 'execute',
            reposJson: JSON.stringify(payload.repos || []),
          },
          onLog: async (log: LogMessage) => {
            await logStorage.addLog(jobId, jobVersion, orgId, log);
            if (websocketManager.hasSubscribers(jobId)) {
              websocketManager.broadcast(jobId, {
                type: 'log',
                data: log,
              });
            }
          },
        });

        await log('info', `[Activity] Execute completed successfully`);

        return { success: true };
      }

      default:
        await log('error', `[Activity] Unknown command received: ${command}`);
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await log(
      'error',
      `[Activity] Command ${command} failed. Error: ${errorMsg}`
    );
    throw error;
  } finally {
    await log('info', `[Activity] Closing gRPC connection to agent`);
    agentClient.close();
  }
}

import * as grpc from '@grpc/grpc-js';
import {
  AgentServiceService,
  type AgentServiceServer,
  type RegisterAgentRequest,
  type RegisterAgentResponse,
  type HealthCheckRequest,
  type HealthCheckResponse,
  type AgentStreamRequest,
  type AgentStreamMessage,
  AgentStreamMessageType,
} from '@sia/models/proto';
import { registerAgent } from './agent-registration-service';
import { agentStreamManager } from './agent-stream-manager';
import { db, schema } from '../db/index';
import { eq } from 'drizzle-orm';
import { logStorage } from './log-storage';
import { websocketManager } from './websocket-manager';
import { queueWorkflowService } from './queue-workflow-service';
import { initializeScheduleForAgent } from './queue-initialization';

export class BackendGrpcServer {
  private server: grpc.Server;

  constructor() {
    this.server = new grpc.Server();
    this.setupService();
  }

  private setupService(): void {
    const registerAgentHandler: grpc.handleUnaryCall<
      RegisterAgentRequest,
      RegisterAgentResponse
    > = async (call, callback) => {
      try {
        const request = call.request;
        const result = await registerAgent({
          apiKey: request.apiKey,
          hostname: request.hostname,
          ipAddress: request.ipAddress,
          port: request.port,
        });

        if (!result.success) {
          callback({
            code: grpc.status.UNAUTHENTICATED,
            message: result.message,
          } as grpc.ServiceError);
          return;
        }

        try {
          await queueWorkflowService.startAgentSchedules(result.agentId);
          await initializeScheduleForAgent(result.agentId, result.orgId);
        } catch (error) {
          console.warn(`Failed to start schedule for agent ${result.agentId}:`, error);
        }

        const response: RegisterAgentResponse = {
          agentId: result.agentId,
          orgId: result.orgId,
          success: true,
          message: result.message,
        };

        callback(null, response);
      } catch (error) {
        console.error('Registration error:', error);
        callback({
          code: grpc.status.INTERNAL,
          message: error instanceof Error ? error.message : 'Registration failed',
        } as grpc.ServiceError);
      }
    };

    const healthCheckHandler: grpc.handleUnaryCall<
      HealthCheckRequest,
      HealthCheckResponse
    > = async (call, callback) => {
      try {
        const request = call.request;
        const agent = await db
          .select()
          .from(schema.agents)
          .where(eq(schema.agents.id, request.agentId))
          .limit(1);

        if (!agent[0]) {
          callback({
            code: grpc.status.NOT_FOUND,
            message: 'Agent not found',
          } as grpc.ServiceError);
          return;
        }

        await db
          .update(schema.agents)
          .set({
            lastActive: new Date(),
            consecutiveFailures: 0,
            updatedAt: new Date(),
          })
          .where(eq(schema.agents.id, request.agentId));

        const response: HealthCheckResponse = {
          success: true,
          timestamp: Date.now(),
          version: '1.0.0',
        };

        callback(null, response);
      } catch (error) {
        console.error('Health check error:', error);
        callback({
          code: grpc.status.INTERNAL,
          message: error instanceof Error ? error.message : 'Health check failed',
        } as grpc.ServiceError);
      }
    };

    const agentStreamHandler: grpc.handleBidiStreamingCall<
      AgentStreamRequest,
      AgentStreamMessage
    > = async (call) => {
      let agentId: string | undefined;
      let orgId: string | undefined;

      call.on('data', async (request: AgentStreamRequest) => {
        try {
          if (!agentId && request.agentId) {
            agentId = request.agentId;
            const agent = await db
              .select()
              .from(schema.agents)
              .where(eq(schema.agents.id, agentId))
              .limit(1);

            if (agent[0]) {
              orgId = agent[0].orgId;
              agentStreamManager.registerStream(agentId, orgId, call);

              await db
                .update(schema.agents)
                .set({
                  lastStreamConnectedAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(schema.agents.id, agentId));
            }
          }

          if (request.messageType === AgentStreamMessageType.LOG_MESSAGE) {
            const logData = JSON.parse(request.payload.toString());
            const { jobId, level, message, timestamp, stage } = logData;

            if (jobId && orgId) {
              const job = await db
                .select()
                .from(schema.jobs)
                .where(eq(schema.jobs.id, jobId))
                .limit(1);

              if (job[0]) {
                // Store summary logs only (detail logs will be added in v1)
                await logStorage.addLog(jobId, job[0].version, orgId, {
                  level,
                  message,
                  timestamp,
                  jobId,
                  stage,
                });

                if (websocketManager.hasSubscribers(jobId)) {
                  websocketManager.broadcast(jobId, {
                    type: 'log',
                    data: {
                      level,
                      message,
                      timestamp,
                      jobId,
                      stage,
                    },
                  });
                }
              }
            }
          } else if (request.messageType === AgentStreamMessageType.HEARTBEAT) {
            if (agentId) {
              await db
                .update(schema.agents)
                .set({
                  lastActive: new Date(),
                  consecutiveFailures: 0,
                  updatedAt: new Date(),
                })
                .where(eq(schema.agents.id, agentId));
            }
          }
        } catch (error) {
          console.error('Error processing stream message:', error);
        }
      });

      call.on('end', () => {
        if (agentId) {
          agentStreamManager.unregisterStream(agentId);
        }
      });

      call.on('error', (error) => {
        console.error('Stream error:', error);
        if (agentId) {
          agentStreamManager.unregisterStream(agentId);
        }
      });
    };

    const serviceImplementation: AgentServiceServer = {
      registerAgent: registerAgentHandler,
      healthCheck: healthCheckHandler,
      agentStream: agentStreamHandler,
    } as any;

    this.server.addService(AgentServiceService, serviceImplementation);
  }

  start(port: string | number = '50052', host = '0.0.0.0'): void {
    const address = `${host}:${port}`;
    this.server.bindAsync(
      address,
      grpc.ServerCredentials.createInsecure(),
      (error) => {
        if (error) {
          console.error(`Failed to start gRPC server: ${error.message}`);
          return;
        }
        this.server.start();
        console.log(`gRPC server listening on ${address}`);
      }
    );
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.tryShutdown(() => {
        console.log('gRPC server stopped');
        resolve();
      });
    });
  }
}


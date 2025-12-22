import * as grpc from '@grpc/grpc-js';
import {
  AgentServiceService,
  AgentServiceServer,
  ExecuteJobRequest,
  HintJobRequest,
  CancelJobRequest,
  LogMessage,
  HintJobResponse,
  CancelJobResponse,
  HealthCheckRequest,
  HealthCheckResponse,
  PRRequest,
  PRResponse,
  CleanupRequest,
  CleanupResponse,
} from '@sia/models';
import type { VibeCodingPlatform } from './vibe/vibe-coding-platform.js';
import { JobVibePlatform } from './vibe/job-vibe-platform.js';
import type { BackendGrpcClient } from './api/backend-grpc-client.js';

class AgentServer {
  private server: grpc.Server;
  private vibePlatform: VibeCodingPlatform;
  private backendClient: BackendGrpcClient | null = null;

  constructor(
    vibePlatform?: VibeCodingPlatform,
    backendClient?: BackendGrpcClient
  ) {
    this.server = new grpc.Server();
    this.vibePlatform = vibePlatform || new JobVibePlatform();
    this.backendClient = backendClient || null;
    this.setupService();
  }

  setBackendClient(backendClient: BackendGrpcClient): void {
    this.backendClient = backendClient;
  }

  private setupService(): void {
    const executeJob: grpc.handleServerStreamingCall<
      ExecuteJobRequest,
      LogMessage
    > = async call => {
      const request = call.request;

      try {
        const logStream = this.vibePlatform.executeJob(
          request.jobId,
          request.prompt,
          request.repoId,
          request.jobDetails
        );

        for await (const logMessage of logStream) {
          call.write(logMessage);
        }

        call.end();
      } catch (error) {
        call.write({
          level: 'error',
          message: `Error executing job: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
          timestamp: new Date().toISOString(),
          jobId: request.jobId,
          stage: 'error',
        });
        call.end();
      }
    };

    const hintJob: grpc.handleUnaryCall<
      HintJobRequest,
      HintJobResponse
    > = async (call, callback) => {
      try {
        const request = call.request;
        const result = await this.vibePlatform.hintJob(
          request.jobId,
          request.hint
        );
        callback(null, result);
      } catch (error) {
        callback({
          code: grpc.status.INTERNAL,
          message: error instanceof Error ? error.message : 'Unknown error',
        } as grpc.ServiceError);
      }
    };

    const cancelJob: grpc.handleUnaryCall<
      CancelJobRequest,
      CancelJobResponse
    > = async (call, callback) => {
      try {
        const request = call.request;
        const result = await this.vibePlatform.cancelJob(request.jobId);
        callback(null, result);
      } catch (error) {
        callback({
          code: grpc.status.INTERNAL,
          message: error instanceof Error ? error.message : 'Unknown error',
        } as grpc.ServiceError);
      }
    };

    const createPr: grpc.handleUnaryCall<PRRequest, PRResponse> = async (
      call,
      callback
    ) => {
      try {
        const request = call.request;
        // Ensure arrays and objects are properly initialized if undefined
        const verificationErrors = request.verificationErrors || [];
        const vibeCoderCredentials = request.vibeCoderCredentials || {};
        const repos = request.repos || [];
        const gitCredentials = request.gitCredentials;

        // Debug logging
        console.log(
          `[AgentServer] createPr - jobId=${request.jobId}, repos: ${repos.length}, ` +
            `vibeCoderCredentials keys: ${Object.keys(
              vibeCoderCredentials
            ).join(', ')}, ` +
            `verificationErrors count: ${verificationErrors.length}, ` +
            `gitCredentials: ${gitCredentials ? 'provided' : 'missing'}`
        );

        const result = await this.vibePlatform.createPR(
          request.jobId,
          request.branchName,
          request.title,
          request.body,
          vibeCoderCredentials,
          verificationErrors,
          repos,
          gitCredentials
        );
        callback(null, result as PRResponse);
      } catch (error) {
        callback({
          code: grpc.status.INTERNAL,
          message: error instanceof Error ? error.message : 'Unknown error',
        } as grpc.ServiceError);
      }
    };

    const cleanupWorkspace: grpc.handleUnaryCall<
      CleanupRequest,
      CleanupResponse
    > = async (call, callback) => {
      try {
        const request = call.request;
        const result = await this.vibePlatform.cleanupWorkspace(request.jobId);
        callback(null, result as CleanupResponse);
      } catch (error) {
        callback({
          code: grpc.status.INTERNAL,
          message: error instanceof Error ? error.message : 'Unknown error',
        } as grpc.ServiceError);
      }
    };

    const healthCheck: grpc.handleUnaryCall<
      HealthCheckRequest,
      HealthCheckResponse
    > = async (call, callback) => {
      try {
        if (this.backendClient) {
          this.backendClient.sendHeartbeat();
          console.log(
            'Heartbeat successfully sent in response to health check API call'
          );
        }

        const response: HealthCheckResponse = {
          success: true,
          timestamp: Date.now(),
          version: '1.0.0',
        };
        callback(null, response);
      } catch (error) {
        callback({
          code: grpc.status.INTERNAL,
          message: error instanceof Error ? error.message : 'Unknown error',
        } as grpc.ServiceError);
      }
    };

    const serviceImplementation: AgentServiceServer = {
      executeJob,
      hintJob,
      cancelJob,
      createPr,
      cleanupWorkspace,
      healthCheck,
    } as any;

    this.server.addService(AgentServiceService, serviceImplementation);
  }

  start(port: string | number = '50051', host = '0.0.0.0'): void {
    const address = `${host}:${port}`;
    this.server.bindAsync(
      address,
      grpc.ServerCredentials.createInsecure(),
      error => {
        if (error) {
          console.error(`Failed to start server: ${error.message}`);
          return;
        }
        this.server.start();
        console.log(`Agent server listening on ${address}`);
      }
    );
  }

  stop(): Promise<void> {
    return new Promise(resolve => {
      this.server.tryShutdown(() => {
        console.log('Agent server stopped');
        resolve();
      });
    });
  }
}

export type { VibeCodingPlatform };
export { AgentServer };

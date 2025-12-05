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
} from '@sia/models';

// TODO: These types will be available after proto regeneration
// For now, use type assertions
type VerificationRequest = { jobId: string };
type PRRequest = { jobId: string; repoId: string; branchName: string; title: string; body: string };
type CleanupRequest = { jobId: string };
import type { VibeCodingPlatform } from './vibe/vibe-coding-platform.js';
import { JobVibePlatform } from './vibe/job-vibe-platform.js';



class AgentServer {
  private server: grpc.Server;
  private vibePlatform: VibeCodingPlatform;

  constructor(vibePlatform?: VibeCodingPlatform) {
    this.server = new grpc.Server();
    this.vibePlatform = vibePlatform || new JobVibePlatform();
    this.setupService();
  }

  private setupService(): void {
    const executeJob: grpc.handleServerStreamingCall<ExecuteJobRequest, LogMessage> = async (call) => {
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
          message: `Error executing job: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date().toISOString(),
          jobId: request.jobId,
          stage: 'error',
        });
        call.end();
      }
    };

    const hintJob: grpc.handleUnaryCall<HintJobRequest, HintJobResponse> = async (call, callback) => {
      try {
        const request = call.request;
        const result = await this.vibePlatform.hintJob(request.jobId, request.hint);
        callback(null, result);
      } catch (error) {
        callback({
          code: grpc.status.INTERNAL,
          message: error instanceof Error ? error.message : 'Unknown error',
        } as grpc.ServiceError);
      }
    };

    const cancelJob: grpc.handleUnaryCall<CancelJobRequest, CancelJobResponse> = async (call, callback) => {
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

    const runVerification: grpc.handleUnaryCall<any, any> = async (call, callback) => {
      try {
        const request = call.request as VerificationRequest;
        const result = await this.vibePlatform.runVerification(request.jobId);
        callback(null, result as any);
      } catch (error) {
        callback({
          code: grpc.status.INTERNAL,
          message: error instanceof Error ? error.message : 'Unknown error',
        } as grpc.ServiceError);
      }
    };

    const createPR: grpc.handleUnaryCall<any, any> = async (call, callback) => {
      try {
        const request = call.request as PRRequest;
        const result = await this.vibePlatform.createPR(
          request.jobId,
          request.repoId,
          request.branchName,
          request.title,
          request.body
        );
        callback(null, result as any);
      } catch (error) {
        callback({
          code: grpc.status.INTERNAL,
          message: error instanceof Error ? error.message : 'Unknown error',
        } as grpc.ServiceError);
      }
    };

    const cleanupWorkspace: grpc.handleUnaryCall<any, any> = async (call, callback) => {
      try {
        const request = call.request as CleanupRequest;
        const result = await this.vibePlatform.cleanupWorkspace(request.jobId);
        callback(null, result as any);
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
      runVerification,
      createPR: createPR as any, // Proto generates createPr, but we use createPR
      cleanupWorkspace,
    } as any;

    this.server.addService(AgentServiceService, serviceImplementation);
  }

  start(port: string | number = '50051', host = '0.0.0.0'): void {
    const address = `${host}:${port}`;
    this.server.bindAsync(
      address,
      grpc.ServerCredentials.createInsecure(),
      (error) => {
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
    return new Promise((resolve) => {
      this.server.tryShutdown(() => {
        console.log('Agent server stopped');
        resolve();
      });
    });
  }
}

export type { VibeCodingPlatform };
export { AgentServer };

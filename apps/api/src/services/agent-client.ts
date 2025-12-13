import * as grpc from '@grpc/grpc-js';
import type {
  ExecuteJobRequest,
  LogMessage,
  HintJobResponse,
  CancelJobResponse,
  HealthCheckRequest,
  HealthCheckResponse,
} from '@sia/models/proto';
import { AgentServiceClient } from '@sia/models/proto';

// TODO: These types will be available after proto regeneration
// For now, define them locally to avoid TypeScript errors
interface VerificationResponse {
  success: boolean;
  message: string;
  errors?: string[];
}

interface PRResponse {
  success: boolean;
  prLink: string;
  message: string;
}

interface CleanupResponse {
  success: boolean;
  message: string;
}

export interface ExecuteJobOptions {
  jobId: string;
  prompt: string;
  repoId?: string;
  jobDetails?: Record<string, string>;
  onLog?: (log: LogMessage) => void;
}

export class AgentClient {
  private client: AgentServiceClient;
  private address: string;

  constructor(address?: string) {
    this.address =
      address || process.env.AGENT_SERVER_ADDRESS || 'localhost:50051';
    console.log(
      `[AgentClient] Initializing gRPC client for address: ${this.address}`
    );
    this.client = new AgentServiceClient(
      this.address,
      grpc.credentials.createInsecure()
    );
    console.log(`[AgentClient] gRPC client created successfully`);
  }

  async executeJob(options: ExecuteJobOptions): Promise<void> {
    const { jobId, prompt, repoId, jobDetails, onLog } = options;

    console.log(
      `[AgentClient] executeJob called for jobId=${jobId}, repoId=${
        repoId || 'none'
      }`
    );

    return new Promise((resolve, reject) => {
      const request: ExecuteJobRequest = {
        jobId,
        prompt,
        repoId: repoId || '',
        jobDetails: jobDetails || {},
      };

      console.log(
        `[AgentClient] Initiating gRPC stream to ${this.address} for executeJob`
      );
      const call = this.client.executeJob(request);

      call.on('data', (log: LogMessage) => {
        console.log(
          `[AgentClient] Received log from agent: level=${log.level}, stage=${
            log.stage || 'none'
          }`
        );
        if (onLog) {
          onLog(log);
        }
      });

      call.on('error', (error: grpc.ServiceError) => {
        console.error(
          `[AgentClient] gRPC error for jobId=${jobId}: code=${
            error.code
          }, message=${error.message}, details=${error.details || 'none'}`
        );
        reject(error);
      });

      call.on('end', () => {
        console.log(`[AgentClient] gRPC stream ended for jobId=${jobId}`);
        resolve();
      });
    });
  }

  async hintJob(jobId: string, hint: string): Promise<HintJobResponse> {
    return new Promise((resolve, reject) => {
      this.client.hintJob(
        { jobId, hint },
        (error: grpc.ServiceError | null, response: HintJobResponse) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  async cancelJob(jobId: string): Promise<CancelJobResponse> {
    return new Promise((resolve, reject) => {
      this.client.cancelJob(
        { jobId },
        (error: grpc.ServiceError | null, response: CancelJobResponse) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  async runVerification(jobId: string): Promise<VerificationResponse> {
    console.log(`[AgentClient] runVerification called for jobId=${jobId}`);
    return new Promise((resolve, reject) => {
      // TODO: Type will be available after proto regeneration
      (this.client as any).runVerification(
        { jobId },
        (error: grpc.ServiceError | null, response: VerificationResponse) => {
          if (error) {
            console.error(
              `[AgentClient] runVerification error for jobId=${jobId}: code=${error.code}, message=${error.message}`
            );
            reject(error);
          } else {
            console.log(
              `[AgentClient] runVerification success for jobId=${jobId}: ${JSON.stringify(
                response
              )}`
            );
            resolve(response);
          }
        }
      );
    });
  }

  async createPR(params: {
    jobId: string;
    repoId: string;
    branchName: string;
    title: string;
    body: string;
  }): Promise<PRResponse> {
    console.log(
      `[AgentClient] createPR called for jobId=${params.jobId}, repoId=${params.repoId}, branch=${params.branchName}`
    );
    return new Promise((resolve, reject) => {
      // TODO: Type will be available after proto regeneration
      (this.client as any).createPR(
        {
          jobId: params.jobId,
          repoId: params.repoId,
          branchName: params.branchName,
          title: params.title,
          body: params.body,
        },
        (error: grpc.ServiceError | null, response: PRResponse) => {
          if (error) {
            console.error(
              `[AgentClient] createPR error for jobId=${params.jobId}: code=${error.code}, message=${error.message}`
            );
            reject(error);
          } else {
            console.log(
              `[AgentClient] createPR success for jobId=${params.jobId}: prLink=${response.prLink}`
            );
            resolve(response);
          }
        }
      );
    });
  }

  async cleanupWorkspace(jobId: string): Promise<CleanupResponse> {
    console.log(`[AgentClient] cleanupWorkspace called for jobId=${jobId}`);
    return new Promise((resolve, reject) => {
      // TODO: Type will be available after proto regeneration
      (this.client as any).cleanupWorkspace(
        { jobId },
        (error: grpc.ServiceError | null, response: CleanupResponse) => {
          if (error) {
            console.error(
              `[AgentClient] cleanupWorkspace error for jobId=${jobId}: code=${error.code}, message=${error.message}`
            );
            reject(error);
          } else {
            console.log(
              `[AgentClient] cleanupWorkspace success for jobId=${jobId}`
            );
            resolve(response);
          }
        }
      );
    });
  }

  async healthCheck(agentId: string): Promise<HealthCheckResponse> {
    console.log(`[AgentClient] healthCheck called for agentId=${agentId}`);
    return new Promise((resolve, reject) => {
      const request: HealthCheckRequest = { agentId };
      this.client.healthCheck(
        request,
        (error: grpc.ServiceError | null, response: HealthCheckResponse) => {
          if (error) {
            console.error(
              `[AgentClient] healthCheck error for agentId=${agentId}: code=${error.code}, message=${error.message}`
            );
            reject(error);
          } else {
            console.log(
              `[AgentClient] healthCheck success for agentId=${agentId}: success=${response.success}`
            );
            resolve(response);
          }
        }
      );
    });
  }

  close(): void {
    console.log(`[AgentClient] Closing gRPC connection to ${this.address}`);
    this.client.close();
  }
}

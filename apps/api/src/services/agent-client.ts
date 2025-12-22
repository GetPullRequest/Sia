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
interface PRResponse {
  success: boolean;
  prLink: string;
  message: string;
  changesSummary?: string;
}

interface CleanupResponse {
  success: boolean;
  message: string;
}

export interface ExecuteJobOptions {
  jobId: string;
  prompt: string;
  repos?: string[];
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
    const { jobId, prompt, repos, jobDetails, onLog } = options;

    console.log(
      `[AgentClient] executeJob called for jobId=${jobId}, repos=${
        repos ? repos.join(', ') : 'none'
      }`
    );

    return new Promise((resolve, reject) => {
      const request: ExecuteJobRequest = {
        jobId,
        prompt,
        repoId: repos && repos.length > 0 ? repos[0] : '', // Use first repo for now (legacy gRPC field)
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

  async createPR(params: {
    jobId: string;
    branchName: string;
    title: string;
    body: string;
    verificationErrors?: string[];
    vibeCoderCredentials?: Record<string, string>;
    repos?: Array<{ repoId: string; name: string; url: string }>;
    gitCredentials?: { token: string; username: string };
  }): Promise<PRResponse> {
    console.log(
      `[AgentClient] createPR called for jobId=${params.jobId}, repos: ${
        params.repos?.length || 0
      }, branch=${params.branchName}`
    );
    return new Promise((resolve, reject) => {
      // Proto generates createPr (camelCase), not createPR
      (this.client as any).createPr(
        {
          jobId: params.jobId,
          branchName: params.branchName,
          title: params.title,
          body: params.body,
          verificationErrors: params.verificationErrors || [],
          vibeCoderCredentials: params.vibeCoderCredentials || {},
          repos: params.repos || [],
          gitCredentials: params.gitCredentials,
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

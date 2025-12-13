import * as grpc from '@grpc/grpc-js';
import {
  AgentServiceClient,
  ExecuteJobRequest,
  LogMessage,
  HintJobResponse,
  CancelJobResponse,
} from '@sia/models';

interface ExecuteJobOptions {
  jobId: string;
  prompt: string;
  repoId?: string;
  jobDetails?: Record<string, string>;
  onLog?: (log: LogMessage) => void;
}

class AgentClient {
  private client: AgentServiceClient;

  constructor(address = 'localhost:50051') {
    this.client = new AgentServiceClient(
      address,
      grpc.credentials.createInsecure()
    );
  }

  async executeJob(options: ExecuteJobOptions): Promise<void> {
    const { jobId, prompt, repoId, jobDetails, onLog } = options;

    return new Promise((resolve, reject) => {
      const request: ExecuteJobRequest = {
        jobId,
        prompt,
        repoId: repoId || '',
        jobDetails: jobDetails || {},
      };

      const call = this.client.executeJob(request);

      call.on('data', (log: LogMessage) => {
        if (onLog) {
          onLog(log);
        } else {
          const timestamp = new Date(log.timestamp).toLocaleTimeString();
          const prefix = `[${timestamp}] [${log.level.toUpperCase()}] [${
            log.stage
          }]`;
          console.log(`${prefix} ${log.message}`);
        }
      });

      call.on('error', (error: grpc.ServiceError) => {
        reject(error);
      });

      call.on('end', () => {
        resolve();
      });
    });
  }

  async hintJob(jobId: string, hint: string): Promise<HintJobResponse> {
    return new Promise((resolve, reject) => {
      this.client.hintJob(
        {
          jobId,
          hint,
        },
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
        {
          jobId,
        },
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

  close(): void {
    this.client.close();
  }
}

export type {
  ExecuteJobOptions,
  LogMessage,
  HintJobResponse,
  CancelJobResponse,
};
export { AgentClient };

import type { LogMessage, Job } from '@sia/models';
import { client, putJobsById } from '@sia/models/api-client';

export interface JobUpdateRequest {
  status?: 'queued' | 'in-progress' | 'completed' | 'failed' | 'archived';
  prLink?: string;
  updatedBy?: string;
  // TODO: Add other updateable fields as needed
}

export class JobApiClient {
  constructor(apiBaseUrl?: string) {
    // Configure API client base URL
    const baseUrl = apiBaseUrl || process.env.API_BASE_URL || 'http://localhost:3001';
    client.setConfig({ baseUrl });
    
    // TODO: Configure authentication if needed
    // client.setConfig({ headers: { 'Authorization': `Bearer ${process.env.API_TOKEN}` } });
  }

  async* updateJob(
    jobId: string,
    updates: JobUpdateRequest
  ): AsyncGenerator<LogMessage, Job> {
    try {
      yield {
        level: 'info',
        message: `Updating job ${jobId} with status: ${updates.status || 'N/A'}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'update-status',
      };

      const requestBody: {
        status?: 'queued' | 'in-progress' | 'completed' | 'failed' | 'archived';
        updated_by: string;
        // TODO: Map prLink to appropriate field when available in API schema
      } = {
        updated_by: updates.updatedBy || 'agent',
      };

      if (updates.status) {
        requestBody.status = updates.status;
      }

      // TODO: Add prLink mapping when the API schema supports it
      // For now, prLink is not in the putJobsById body type

      const result = await putJobsById({
        path: { id: jobId },
        body: requestBody,
      });

      yield {
        level: 'success',
        message: `Successfully updated job ${jobId}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'update-status',
      };

      return result.data as Job;
    } catch (error) {
      yield {
        level: 'error',
        message: `Failed to update job: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'update-status',
      };
      throw error;
    }
  }

  async updateJobSync(jobId: string, updates: JobUpdateRequest): Promise<Job> {
    const requestBody: {
      status?: 'queued' | 'in-progress' | 'completed' | 'failed' | 'archived';
      updated_by: string;
    } = {
      updated_by: updates.updatedBy || 'agent',
    };

    if (updates.status) {
      requestBody.status = updates.status;
    }

    // TODO: Add prLink mapping when the API schema supports it

    const result = await putJobsById({
      path: { id: jobId },
      body: requestBody,
    });

    return result.data as Job;
  }
}



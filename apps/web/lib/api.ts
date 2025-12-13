import { supportedIntegrations, mockActivityEvents } from './mockData';
import {
  client,
  getJobs,
  postJobs,
  getJobsById,
  putJobsById,
  deleteJobsById,
  deleteReposGithubProvidersById,
  deleteIntegrationsSlackProvidersById,
  postJobsByIdExecute,
  postJobsByIdReprioritize,
  getReposGithubProvidersByProviderIdRepos,
  getActivities as getActivitiesSdk,
  getActivitiesById as getActivitiesByIdSdk,
  putActivitiesByIdReadStatus,
  deleteActivitiesById as deleteActivitiesByIdSdk,
  getIntegrationsSecrets,
  postIntegrationsSecrets,
  deleteIntegrationsSecretsById,
  getApiKeys,
  postApiKeys,
  deleteApiKeysById,
  postQueuesByQueueTypePause,
  postQueuesByQueueTypeResume,
  getQueuesByQueueTypeStatus,
  getJobsByIdLogs,
  getAgents,
  getAgentsById,
  putAgentsById,
  postAgents,
} from '@sia/models/api-client';
import type {
  Job,
  CreateJobRequest,
  RepoProvider,
  Activity,
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  Agent as GeneratedAgent,
  CreateAgentRequest as GeneratedCreateAgentRequest,
  UpdateAgentRequest as GeneratedUpdateAgentRequest,
} from '@sia/models';
import type { JobResponse } from '@/types';
import type { Agent, Integration, ActivityEvent } from '@/types';

export type Repo = {
  id: string;
  name: string;
  description?: string;
  url: string;
  repo_provider_id: string;
  created_at: string;
  updated_at: string;
};

// In-memory store for demo purposes (for features not yet in API)
const integrations = [...supportedIntegrations];
const activityEvents = [...mockActivityEvents];

// Token getter function - can be set from React components
type TokenGetter = () => Promise<string | null> | string | null;
let tokenGetter: TokenGetter | null = null;

// User ID getter function - can be set from React components
type UserIdGetter = () => string | null | undefined;
let userIdGetter: UserIdGetter | null = null;

export const setTokenGetter = (getter: TokenGetter) => {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log(
      '[API] setTokenGetter called',
      getter !== null ? 'with function' : 'with null'
    );
  }
  tokenGetter = getter;
};

export const setUserIdGetter = (getter: UserIdGetter) => {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log(
      '[API] setUserIdGetter called',
      getter !== null ? 'with function' : 'with null'
    );
  }
  userIdGetter = getter;
};

export const getUserId = (): string => {
  if (userIdGetter) {
    try {
      const userId = userIdGetter();
      if (userId) {
        return userId;
      }
    } catch (error) {
      console.error('[API] Failed to get user ID:', error);
    }
  }
  return 'sia-system';
};

export const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {};

  // Wait for tokenGetter to be set (with timeout)
  const maxRetries = 10; // 10 retries * 500ms = 5 seconds max wait
  let retries = 0;

  while (!tokenGetter && retries < maxRetries) {
    if (
      typeof window !== 'undefined' &&
      process.env.NODE_ENV === 'development'
    ) {
      console.log(
        `[API] Waiting for tokenGetter to be set... (attempt ${
          retries + 1
        }/${maxRetries})`
      );
    }
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
    retries++;
  }

  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[API] getAuthHeaders called');
    console.log('[API] tokenGetter exists:', !!tokenGetter);
  }

  if (!tokenGetter) {
    if (
      typeof window !== 'undefined' &&
      process.env.NODE_ENV === 'development'
    ) {
      console.warn(
        '[API] tokenGetter is not set after waiting - auth provider may not be initialized'
      );
    }
    return headers;
  }

  try {
    if (
      typeof window !== 'undefined' &&
      process.env.NODE_ENV === 'development'
    ) {
      console.log('[API] Calling tokenGetter...');
    }
    const token = await tokenGetter();

    if (
      typeof window !== 'undefined' &&
      process.env.NODE_ENV === 'development'
    ) {
      console.log(
        '[API] Token received:',
        token ? `${token.substring(0, 20)}...` : 'null/undefined'
      );
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      if (
        typeof window !== 'undefined' &&
        process.env.NODE_ENV === 'development'
      ) {
        console.log('[API] Authorization header added successfully');
      }
    } else {
      if (
        typeof window !== 'undefined' &&
        process.env.NODE_ENV === 'development'
      ) {
        console.warn(
          '[API] No token returned from tokenGetter - user may not be authenticated'
        );
      }
    }
  } catch (error) {
    console.error('[API] Failed to get auth token:', error);
  }

  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[API] Final headers:', Object.keys(headers));
    console.log('[API] Has Authorization:', !!headers.Authorization);
  }

  return headers;
};

// Configure API client base URL
if (typeof window !== 'undefined') {
  const baseUrl =
    process.env.NEXT_PUBLIC_SIA_BACKEND_URL || 'http://localhost:3001';
  client.setConfig({ baseUrl });
}

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
  // Jobs - using generated API client from @sia/models
  async getJobs(): Promise<JobResponse[]> {
    const headers = await getAuthHeaders();
    const result = await getJobs({
      headers,
    });
    return (result.data as JobResponse[]) || [];
  },

  async getJob(id: string): Promise<Job | undefined> {
    try {
      const headers = await getAuthHeaders();
      const result = await getJobsById({
        path: { id },
        headers,
      });
      return result.data as JobResponse;
    } catch (error) {
      console.error('Failed to fetch job:', error);
      return undefined;
    }
  },

  async getJobLogs(
    jobId: string,
    version?: number
  ): Promise<
    Array<{
      level: string;
      timestamp: string;
      message: string;
      stage?: string;
    }>
  > {
    try {
      const headers = await getAuthHeaders();
      const result = await getJobsByIdLogs({
        path: { id: jobId },
        query: version ? { version: version.toString() } : undefined,
        headers,
      });
      return (
        (result.data as Array<{
          level: string;
          timestamp: string;
          message: string;
          stage?: string;
        }>) || []
      );
    } catch (error) {
      console.error('Failed to fetch job logs:', error);
      return [];
    }
  },

  async createJob(job: CreateJobRequest): Promise<JobResponse> {
    const headers = await getAuthHeaders();
    const result = await postJobs({
      body: job,
      headers,
    });
    return result.data as JobResponse;
  },

  async updateJobStatus(
    id: string,
    status: 'queued' | 'in-progress' | 'completed' | 'failed' | 'archived'
  ): Promise<JobResponse | undefined> {
    try {
      const headers = await getAuthHeaders();
      const apiStatus = status === 'archived' ? 'failed' : status;
      const result = await putJobsById({
        path: { id },
        body: {
          status: apiStatus,
          updated_by: getUserId(),
        },
        headers,
      });
      return result.data as JobResponse;
    } catch (error) {
      console.error('Failed to update job status:', error);
      return undefined;
    }
  },

  async updateJob(
    id: string,
    updates: Partial<Job>
  ): Promise<JobResponse | undefined> {
    try {
      const headers = await getAuthHeaders();
      const result = await putJobsById({
        path: { id },
        body: {
          ...updates,
          updated_by: getUserId(),
        },
        headers,
      });
      return result.data as JobResponse;
    } catch (error) {
      console.error('Failed to update job:', error);
      throw error;
    }
  },

  async reorderJobs(reorderedJobs: JobResponse[]): Promise<JobResponse[]> {
    const headers = await getAuthHeaders();
    // Update priority based on position
    const updatePromises = reorderedJobs.map((job, index) => {
      const priority =
        index === 0
          ? 'high'
          : index === 1
          ? 'medium'
          : index < reorderedJobs.length - 1
          ? 'medium'
          : 'low';
      return putJobsById({
        path: { id: job.id },
        body: {
          priority,
          order_in_queue: index,
          updated_by: getUserId(),
        },
        headers,
      }).catch(() => ({ data: job } as { data: JobResponse }));
    });

    await Promise.all(updatePromises);
    const result = await getJobs({ headers });
    return result.data as JobResponse[];
  },

  async reprioritizeJob(
    jobId: string,
    position: number
  ): Promise<{ message: string; job: JobResponse } | undefined> {
    try {
      const headers = await getAuthHeaders();
      const result = await postJobsByIdReprioritize({
        path: { id: jobId },
        body: {
          position,
        },
        headers,
      });
      return result.data as { message: string; job: JobResponse };
    } catch (error) {
      console.error('Failed to reprioritize job:', error);
      throw error;
    }
  },

  async getQueueStatus(
    queueType: 'rework' | 'backlog'
  ): Promise<{ isPaused: boolean }> {
    const headers = await getAuthHeaders();
    const result = await getQueuesByQueueTypeStatus({
      path: { queueType },
      headers,
    });
    const data = (result.data || {}) as { isPaused?: boolean };
    return { isPaused: !!data.isPaused };
  },

  async pauseQueue(
    queueType: 'rework' | 'backlog'
  ): Promise<{ message?: string }> {
    const headers = await getAuthHeaders();
    const result = await postQueuesByQueueTypePause({
      path: { queueType },
      headers,
    });
    return (result.data as { message?: string }) || {};
  },

  async resumeQueue(
    queueType: 'rework' | 'backlog'
  ): Promise<{ message?: string }> {
    const headers = await getAuthHeaders();
    const result = await postQueuesByQueueTypeResume({
      path: { queueType },
      headers,
    });
    return (result.data as { message?: string }) || {};
  },

  async deleteJob(id: string): Promise<void> {
    try {
      const headers = await getAuthHeaders();
      await deleteJobsById({
        path: { id },
        headers,
      });
    } catch (error) {
      console.error('Failed to delete job:', error);
      throw error;
    }
  },

  // Agents
  async getAgents(): Promise<Agent[]> {
    const headers = await getAuthHeaders();
    const result = await getAgents({
      headers,
    });
    const agents = (result.data as GeneratedAgent[]) || [];
    return agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      status: agent.status,
      config: {
        ip: agent.ip || '',
        host: agent.host || '',
        port: agent.port,
      },
      lastActive: agent.last_active || new Date().toISOString(),
      vibeConnectionId: (agent as any).vibe_connection_id,
      vibeConnection: (agent as any).vibe_connection
        ? {
            id: (agent as any).vibe_connection.id,
            name: (agent as any).vibe_connection.name,
            providerType: (agent as any).vibe_connection.provider_type,
          }
        : undefined,
      recentActivity: [],
    }));
  },

  async getAgent(id: string): Promise<Agent | undefined> {
    const headers = await getAuthHeaders();
    try {
      const result = await getAgentsById({
        path: { id },
        headers,
      });
      const agent = result.data as GeneratedAgent;
      return {
        id: agent.id,
        name: agent.name,
        status: agent.status,
        config: {
          ip: agent.ip || '',
          host: agent.host || '',
          port: agent.port,
        },
        lastActive: agent.last_active || new Date().toISOString(),
        vibeConnectionId: (agent as any).vibe_connection_id,
        vibeConnection: (agent as any).vibe_connection
          ? {
              id: (agent as any).vibe_connection.id,
              name: (agent as any).vibe_connection.name,
              providerType: (agent as any).vibe_connection.provider_type,
            }
          : undefined,
        recentActivity: [],
      };
    } catch (error: any) {
      if (error?.status === 404) {
        return undefined;
      }
      throw error;
    }
  },

  async createAgent(data: {
    name: string;
    host: string;
    port: number;
    ip?: string;
    status?: 'active' | 'idle' | 'offline';
    vibe_connection_id?: string;
  }): Promise<Agent> {
    const headers = await getAuthHeaders();
    const requestBody: GeneratedCreateAgentRequest & {
      vibe_connection_id?: string;
    } = {
      name: data.name,
      host: data.host,
      port: data.port,
      ip: data.ip,
      status: data.status,
      vibe_connection_id: data.vibe_connection_id,
    };
    const result = await postAgents({
      body: requestBody,
      headers,
    });
    const agent = result.data as GeneratedAgent & {
      vibe_connection_id?: string;
      vibe_connection?: any;
    };
    return {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      config: {
        ip: agent.ip || '',
        host: agent.host || '',
        port: agent.port,
      },
      lastActive: agent.last_active || new Date().toISOString(),
      vibeConnectionId: agent.vibe_connection_id,
      vibeConnection: agent.vibe_connection
        ? {
            id: agent.vibe_connection.id,
            name: agent.vibe_connection.name,
            providerType: agent.vibe_connection.provider_type,
          }
        : undefined,
      recentActivity: [],
    };
  },

  async updateAgent(
    id: string,
    data: {
      name?: string;
      host?: string;
      port?: number;
      ip?: string;
      status?: 'active' | 'idle' | 'offline';
      vibe_connection_id?: string;
    }
  ): Promise<Agent> {
    const headers = await getAuthHeaders();
    const requestBody: GeneratedUpdateAgentRequest & {
      vibe_connection_id?: string;
    } = {
      name: data.name,
      host: data.host,
      port: data.port,
      ip: data.ip,
      status: data.status,
      vibe_connection_id: data.vibe_connection_id,
    };
    const result = await putAgentsById({
      path: { id },
      body: requestBody,
      headers,
    });
    const agent = result.data as GeneratedAgent & {
      vibe_connection_id?: string;
      vibe_connection?: any;
    };
    return {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      config: {
        ip: agent.ip || '',
        host: agent.host || '',
        port: agent.port,
      },
      lastActive: agent.last_active || new Date().toISOString(),
      vibeConnectionId: agent.vibe_connection_id,
      vibeConnection: agent.vibe_connection
        ? {
            id: agent.vibe_connection.id,
            name: agent.vibe_connection.name,
            providerType: agent.vibe_connection.provider_type,
          }
        : undefined,
      recentActivity: [],
    };
  },

  async toggleAgentStatus(id: string): Promise<Agent | undefined> {
    const agent = await this.getAgent(id);
    if (!agent) {
      return undefined;
    }
    const newStatus =
      agent.status === 'active'
        ? 'idle'
        : agent.status === 'idle'
        ? 'offline'
        : 'active';
    return this.updateAgent(id, { status: newStatus });
  },

  async reconnectAgent(
    id: string
  ): Promise<{ success: boolean; message: string; agent: Agent }> {
    const headers = await getAuthHeaders();
    const baseUrl =
      process.env.NEXT_PUBLIC_SIA_BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${baseUrl}/agents/${id}/reconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });
    if (!response.ok) {
      throw new Error('Failed to reconnect agent');
    }
    const data = await response.json();
    const agent = data.agent as GeneratedAgent & {
      vibe_connection_id?: string;
      vibe_connection?: any;
    };
    return {
      success: data.success,
      message: data.message,
      agent: {
        id: agent.id,
        name: agent.name,
        status: agent.status,
        config: {
          ip: agent.ip || '',
          host: agent.host || '',
          port: agent.port,
        },
        lastActive: agent.last_active || new Date().toISOString(),
        vibeConnectionId: agent.vibe_connection_id,
        vibeConnection: agent.vibe_connection
          ? {
              id: agent.vibe_connection.id,
              name: agent.vibe_connection.name,
              providerType: agent.vibe_connection.provider_type,
            }
          : undefined,
        recentActivity: [],
      },
    };
  },

  // Integrations
  async getIntegrations(): Promise<Integration[]> {
    await delay(300);
    return integrations;
  },

  async toggleIntegration(id: string): Promise<Integration | undefined> {
    await delay(800); // Simulate OAuth flow
    const integration = integrations.find(i => i.id === id);
    if (integration) {
      integration.status =
        integration.status === 'connected' ? 'disconnected' : 'connected';
    }
    return integration;
  },

  // Activity
  async getActivityEvents(): Promise<ActivityEvent[]> {
    await delay(200);
    return activityEvents.slice(0, 10);
  },

  // Activities - using generated API client from @sia/models
  async getActivities(): Promise<Activity[]> {
    const headers = await getAuthHeaders();
    const result = await getActivitiesSdk({
      headers,
    });
    return (result.data as Activity[]) || [];
  },

  async getActivity(id: string): Promise<Activity | undefined> {
    try {
      const headers = await getAuthHeaders();
      const result = await getActivitiesByIdSdk({
        path: { id },
        headers,
      });
      return result.data as Activity;
    } catch (error) {
      console.error('Failed to fetch activity:', error);
      return undefined;
    }
  },

  async updateActivityReadStatus(
    activityId: string,
    readStatus: 'read' | 'unread'
  ): Promise<{ message: string; read_status: string }> {
    try {
      const headers = await getAuthHeaders();
      const result = await putActivitiesByIdReadStatus({
        path: { id: activityId },
        headers,
        body: { is_read: readStatus === 'read' },
      });
      return (
        (result.data as { message: string; read_status: string }) || {
          message: 'Success',
          read_status: readStatus,
        }
      );
    } catch (error) {
      console.error('Failed to update activity read status:', error);
      throw error;
    }
  },

  async deleteActivity(activityId: string): Promise<Activity> {
    try {
      const headers = await getAuthHeaders();
      const result = await deleteActivitiesByIdSdk({
        path: { id: activityId },
        headers,
      });
      return result.data as Activity;
    } catch (error) {
      console.error('Failed to delete activity:', error);
      throw error;
    }
  },

  // GitHub Providers
  async getGitHubProviders(): Promise<RepoProvider[]> {
    const authHeaders = await getAuthHeaders();
    const baseUrl =
      process.env.NEXT_PUBLIC_SIA_BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${baseUrl}/repos/github/providers`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch GitHub providers');
    }
    return response.json();
  },

  async connectGitHub(): Promise<string> {
    const authHeaders = await getAuthHeaders();
    const baseUrl =
      process.env.NEXT_PUBLIC_SIA_BACKEND_URL || 'http://localhost:3001';
    // Use fetch with redirect: 'manual' to handle the 302 redirect from the backend
    // The SDK client would automatically follow redirects, which we don't want here
    const url = `${baseUrl}/repos/github/connect`;

    if (
      typeof window !== 'undefined' &&
      process.env.NODE_ENV === 'development'
    ) {
      console.log('Connecting to GitHub via:', url);
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...authHeaders,
        },
        redirect: 'manual',
        credentials: 'include',
      });

      if (
        typeof window !== 'undefined' &&
        process.env.NODE_ENV === 'development'
      ) {
        console.log('[API] Response status:', response.status);
        console.log('[API] Response type:', response.type);
        console.log('[API] Response URL:', response.url);
      }

      // Handle JSON response with redirectUrl (for CORS compatibility)
      if (response.status === 200) {
        try {
          const data = await response.json();
          if (data.redirectUrl) {
            if (
              typeof window !== 'undefined' &&
              process.env.NODE_ENV === 'development'
            ) {
              console.log(
                '[API] Redirect URL from JSON response:',
                data.redirectUrl
              );
            }
            return data.redirectUrl;
          }
        } catch {
          // Not JSON, continue to check for redirect
        }
      }

      // Handle redirect responses (302, 307, 308) - fallback for direct browser access
      if (
        response.status === 302 ||
        response.status === 307 ||
        response.status === 308
      ) {
        const location = response.headers.get('Location');
        if (
          typeof window !== 'undefined' &&
          process.env.NODE_ENV === 'development'
        ) {
          console.log('[API] Redirect Location header:', location);
        }
        if (location) {
          return location;
        }
        // If Location header is not accessible (CORS), try response.url
        if (response.url && response.url !== url) {
          if (
            typeof window !== 'undefined' &&
            process.env.NODE_ENV === 'development'
          ) {
            console.log('[API] Using response.url as redirect:', response.url);
          }
          return response.url;
        }
      }

      // Handle opaque redirect (status 0) - CORS blocked Location header access
      // This happens when the redirect goes to a different origin
      if (response.status === 0 || response.type === 'opaqueredirect') {
        if (
          typeof window !== 'undefined' &&
          process.env.NODE_ENV === 'development'
        ) {
          console.log(
            '[API] Opaque redirect detected, response.url:',
            response.url
          );
        }
        if (response.url && response.url.startsWith('https://github.com')) {
          return response.url;
        }
        throw new Error(
          'Unable to redirect to GitHub. Please try again or contact support.'
        );
      }

      // Check for error responses
      if (response.status >= 400) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Couldn't parse JSON, use status text
        }

        if (response.status === 404) {
          throw new Error(
            `Route not found: ${url}. Please check that the backend server is running and the route is registered.`
          );
        }

        throw new Error(errorMessage);
      }

      // Unexpected response
      throw new Error(
        `Unexpected response: ${response.status} ${response.statusText}`
      );
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(
          `Failed to connect to backend at ${baseUrl}. Please check that the server is running.`
        );
      }
      throw error;
    }
  },

  async disconnectGitHubProvider(providerId: string): Promise<void> {
    const authHeaders = await getAuthHeaders();
    await deleteReposGithubProvidersById({
      path: { id: providerId },
      headers: authHeaders,
    });
  },

  // Slack Providers
  async getSlackProviders(): Promise<
    Array<{
      id: string;
      name: string;
      provider_team_id?: string;
      management_url?: string;
      [key: string]: unknown;
    }>
  > {
    const authHeaders = await getAuthHeaders();
    const baseUrl =
      process.env.NEXT_PUBLIC_SIA_BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${baseUrl}/integrations/slack/providers`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch Slack providers');
    }
    return response.json();
  },

  async connectSlack(): Promise<string> {
    const authHeaders = await getAuthHeaders();
    const baseUrl =
      process.env.NEXT_PUBLIC_SIA_BACKEND_URL || 'http://localhost:3001';
    const redirectUri = `${
      process.env.NEXT_PUBLIC_FRONT_END_URL || 'http://localhost:3000'
    }/integrations/slack/callback`;
    const url = `${baseUrl}/integrations/slack/connect?redirect_uri=${encodeURIComponent(
      redirectUri
    )}`;

    if (
      typeof window !== 'undefined' &&
      process.env.NODE_ENV === 'development'
    ) {
      console.log('Connecting to Slack via:', url);
      console.log('Redirect URI:', redirectUri);
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...authHeaders,
        },
        redirect: 'manual',
        credentials: 'include',
      });

      if (
        typeof window !== 'undefined' &&
        process.env.NODE_ENV === 'development'
      ) {
        console.log('[API] Slack response status:', response.status);
        console.log('[API] Slack response type:', response.type);
        console.log('[API] Slack response URL:', response.url);
      }

      // Handle JSON response with redirectUrl (for CORS compatibility)
      if (response.status === 200) {
        try {
          const data = await response.json();
          if (data.redirectUrl) {
            if (
              typeof window !== 'undefined' &&
              process.env.NODE_ENV === 'development'
            ) {
              console.log(
                '[API] Slack redirect URL from JSON response:',
                data.redirectUrl
              );
            }
            return data.redirectUrl;
          }
        } catch {
          // Not JSON, continue to check for redirect
        }
      }

      // Handle redirect responses (302, 307, 308)
      if (
        response.status === 302 ||
        response.status === 307 ||
        response.status === 308
      ) {
        const location = response.headers.get('Location');
        if (
          typeof window !== 'undefined' &&
          process.env.NODE_ENV === 'development'
        ) {
          console.log('[API] Slack redirect Location header:', location);
        }
        if (location) {
          return location;
        }
        if (response.url && response.url !== url) {
          if (
            typeof window !== 'undefined' &&
            process.env.NODE_ENV === 'development'
          ) {
            console.log('[API] Using response.url as redirect:', response.url);
          }
          return response.url;
        }
      }

      // Handle opaque redirect
      if (response.status === 0 || response.type === 'opaqueredirect') {
        if (
          typeof window !== 'undefined' &&
          process.env.NODE_ENV === 'development'
        ) {
          console.log(
            '[API] Opaque redirect detected, response.url:',
            response.url
          );
        }
        if (response.url && response.url.startsWith('https://slack.com')) {
          return response.url;
        }
        throw new Error(
          'Unable to redirect to Slack. Please try again or contact support.'
        );
      }

      // Check for error responses
      if (response.status >= 400) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Couldn't parse JSON, use status text
        }

        if (response.status === 404) {
          throw new Error(
            `Route not found: ${url}. Please check that the backend server is running and the route is registered.`
          );
        }

        throw new Error(errorMessage);
      }

      // Unexpected response
      throw new Error(
        `Unexpected response: ${response.status} ${response.statusText}`
      );
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(
          `Failed to connect to backend at ${baseUrl}. Please check that the server is running.`
        );
      }
      throw error;
    }
  },

  async disconnectSlackProvider(providerId: string): Promise<void> {
    const authHeaders = await getAuthHeaders();
    await deleteIntegrationsSlackProvidersById({
      path: { id: providerId },
      headers: authHeaders,
    });
  },

  // GitHub Repos
  async getGitHubRepos(providerId: string): Promise<
    Array<{
      id: string;
      name: string;
      description?: string;
      url: string;
      repo_provider_id: string;
      created_at: string;
      updated_at: string;
    }>
  > {
    const authHeaders = await getAuthHeaders();
    const result = await getReposGithubProvidersByProviderIdRepos({
      path: { providerId },
      headers: authHeaders,
    });
    return (
      (result.data as Array<{
        id: string;
        name: string;
        description?: string;
        url: string;
        repo_provider_id: string;
        created_at: string;
        updated_at: string;
      }>) || []
    );
  },

  async getAllRepos(): Promise<Repo[]> {
    const authHeaders = await getAuthHeaders();
    const response = await client.get({
      url: '/repos',
      headers: authHeaders,
    });
    return (response.data as Repo[]) || [];
  },

  async updateRepoDescription(
    repoId: string,
    description: string
  ): Promise<Repo> {
    const authHeaders = await getAuthHeaders();
    const response = await client.patch({
      url: `/repos/${repoId}`,
      headers: authHeaders,
      body: { description },
    });
    return response.data as Repo;
  },

  async getIntegrationSecrets(providerType?: string): Promise<
    Array<{
      id: string;
      providerType: string;
      name: string;
      storageType: 'gcp' | 'encrypted_local';
      createdAt: string;
      updatedAt: string;
    }>
  > {
    const headers = await getAuthHeaders();
    const result = await getIntegrationsSecrets({
      headers,
      ...(providerType ? { query: { providerType } } : {}),
    });
    return (
      (result.data as Array<{
        id: string;
        providerType: string;
        name: string;
        storageType: 'gcp' | 'encrypted_local';
        createdAt: string;
        updatedAt: string;
      }>) || []
    );
  },

  async storeIntegrationSecret(data: {
    providerType: string;
    name: string;
    apiKey?: string;
  }): Promise<{
    id: string;
    providerType: string;
    name: string;
    storageType: 'gcp' | 'encrypted_local';
    createdAt: string;
  }> {
    const headers = await getAuthHeaders();
    const result = await postIntegrationsSecrets({
      body: data,
      headers,
    });

    if (result.error) {
      const errorMessage =
        (result.error as { error?: string })?.error ||
        'Failed to store integration secret';
      throw new Error(errorMessage);
    }

    if (!result.data) {
      throw new Error('Invalid response from API: missing data');
    }

    return result.data as {
      id: string;
      providerType: string;
      name: string;
      storageType: 'gcp' | 'encrypted_local';
      createdAt: string;
    };
  },

  async deleteIntegrationSecret(id: string): Promise<void> {
    const headers = await getAuthHeaders();
    await deleteIntegrationsSecretsById({
      path: { id },
      headers,
    });
  },

  async getApiKeys(): Promise<ApiKey[]> {
    const headers = await getAuthHeaders();
    const result = await getApiKeys({
      headers,
    });
    return (result.data as ApiKey[]) || [];
  },

  async createApiKey(name: string): Promise<CreateApiKeyResponse> {
    const headers = await getAuthHeaders();
    const result = await postApiKeys({
      body: { name } as CreateApiKeyRequest,
      headers,
    });
    // The SDK returns { data: T } structure for successful responses
    if (!result || !result.data) {
      console.error('Unexpected API response:', result);
      throw new Error('Invalid response from API: missing data');
    }
    const responseData = result.data;
    if (
      !responseData ||
      typeof responseData !== 'object' ||
      !('apiKey' in responseData)
    ) {
      console.error('Unexpected API response structure:', responseData);
      throw new Error('Invalid response from API: missing apiKey field');
    }
    return responseData as CreateApiKeyResponse;
  },

  async deleteApiKey(id: string): Promise<void> {
    const headers = await getAuthHeaders();
    await deleteApiKeysById({
      path: { id },
      headers,
    });
  },
};

/**
 * Start job execution using the API
 * This triggers the backend to execute the job
 */
export const startJobExecution = async (
  jobId: string
): Promise<{ message?: string; jobId?: string } | undefined> => {
  try {
    const headers = await getAuthHeaders();
    const result = await postJobsByIdExecute({
      path: { id: jobId },
      headers,
    });
    return result.data as { message?: string; jobId?: string };
  } catch (error) {
    console.error('Failed to start job execution:', error);
    throw error;
  }
};

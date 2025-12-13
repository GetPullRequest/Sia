import type { SourceMetadata } from './db/schema';

export type JobStatus =
  | 'queued'
  | 'in-progress'
  | 'in-review'
  | 'completed'
  | 'failed'
  | 'archived';
export type JobPriority = 'low' | 'medium' | 'high';
export type AgentStatus = 'active' | 'idle' | 'offline';
export type IntegrationStatus = 'connected' | 'disconnected';
export type UserInputSource = 'slack' | 'discord' | 'mobile' | 'gh-issues';
export type UserAcceptanceStatus =
  | 'not_reviewed'
  | 'reviewed_and_accepted'
  | 'reviewed_and_asked_rework'
  | 'rejected';
export type ActivityEventType =
  | 'pr_created'
  | 'job_failed'
  | 'job_completed'
  | 'job_started'
  | 'agent_connected'
  | 'agent_disconnected';
// ActivityStatus removed - activities now only track read/unread status per user
// All job details are in the summary field

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  config: {
    ip: string;
    host: string;
    port: number;
  };
  lastActive: string;
  recentActivity: Array<{
    id: string;
    action: string;
    timestamp: string;
  }>;
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  status: IntegrationStatus;
  icon: string;
}

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  message: string;
  timestamp: string;
  jobId?: string;
}

export interface UserInput {
  source: UserInputSource;
  prompt: string;
  sourceMetadata?: SourceMetadata;
}

export interface UserComment {
  file_name: string;
  line_no: number;
  prompt: string;
}

export interface CreateJobRequest {
  user_input: UserInput;
  repo?: string;
  created_by: string;
}

export interface UpdateJobRequest {
  generated_name?: string;
  generated_description?: string;
  status?: JobStatus;
  priority?: JobPriority;
  order_in_queue?: number;
  user_input?: UserInput;
  repo?: string;
  updated_by: string;
  user_comments?: UserComment[];
  user_acceptance_status?: UserAcceptanceStatus;
  queue_type?: 'rework' | 'backlog';
}

export interface CreateActivityRequest {
  name: string; // Short title like "Job Created", "Job Updated"
  job_id: string;
  summary: string; // Descriptive summary with all details (required)
  created_by: string;
  code_generation_logs?: string;
  verification_logs?: string;
}

export interface UpdateActivityRequest {
  name?: string;
  summary?: string;
  updated_by: string;
  code_generation_logs?: string;
  verification_logs?: string;
}

export interface UpdateActivityReadStatusRequest {
  is_read: boolean;
}

export interface ReprioritizeJobRequest {
  position: number;
}

export interface CreateAgentRequest {
  name: string;
  host: string;
  port: number;
  ip?: string;
  status?: AgentStatus;
  vibe_connection_id?: string;
}

export interface UpdateAgentRequest {
  name?: string;
  host?: string;
  port?: number;
  ip?: string;
  status?: AgentStatus;
  vibe_connection_id?: string;
}

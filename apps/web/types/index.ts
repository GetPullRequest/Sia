// Re-export types from @sia/models (generated code)
export type {
  Job,
  JobResponse,
  UserInput,
  UserComment,
  CreateJobRequest,
  UpdateJobRequest,
} from '@sia/models';

// Types below are not part of the generated models, so they are defined locally here
// These match the definitions from apps/api/src/types.ts

export type JobStatus =
  | 'queued'
  | 'in-progress'
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
  vibeConnectionId?: string;
  vibeConnection?: {
    id: string;
    name: string;
    providerType: string;
  };
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

import { ReactNode } from 'react';

export type TimelineSize = 'sm' | 'md' | 'lg';
export type TimelineStatus = 'completed' | 'in-progress' | 'pending';
export type TimelineColor =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'accent'
  | 'destructive';

export interface TimelineElement {
  id: number;
  date: string;
  title: string;
  description: string;
  icon?: ReactNode | (() => ReactNode);
  status?: TimelineStatus;
  color?: TimelineColor;
  size?: TimelineSize;
  loading?: boolean;
  error?: string;
}

export interface TimelineProps {
  items: TimelineElement[];
  size?: TimelineSize;
  animate?: boolean;
  iconColor?: TimelineColor;
  connectorColor?: TimelineColor;
  className?: string;
}

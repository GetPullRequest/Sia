import {
  pgTable,
  varchar,
  integer,
  timestamp,
  jsonb,
  pgEnum,
  primaryKey,
  index,
  uuid,
  boolean,
} from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

export const jobStatusEnum = pgEnum('gpr_job_status', [
  'queued',
  'in-progress',
  'in-review',
  'completed',
  'failed',
  'archived',
]);

export const jobPriorityEnum = pgEnum('gpr_job_priority', [
  'low',
  'medium',
  'high',
]);

export const queueTypeEnum = pgEnum('gpr_queue_type', ['rework', 'backlog']);

export const agentStatusEnum = pgEnum('gpr_agent_status', [
  'active',
  'idle',
  'offline',
]);

export const userInputSourceEnum = pgEnum('gpr_user_input_source', [
  'slack',
  'discord',
  'mobile',
  'gh-issues',
]);

export const userAcceptanceStatusEnum = pgEnum('gpr_user_acceptance_status', [
  'not_reviewed',
  'reviewed_and_accepted',
  'reviewed_and_asked_rework',
  'rejected',
]);

export const repoProviderAppNameEnum = pgEnum('gpr_repo_provider_app_name', [
  'github',
  'gitlab',
  'bitbucket',
]);

export const vibeAgentEnum = pgEnum('gpr_vibe_agent', [
  'cursor',
  'kiro-cli',
  'claude-code',
]);

// Activity status enum is now only for read/unread tracking per user
// Job details are stored in the summary field
export const activityReadStatusEnum = pgEnum('gpr_activity_read_status', [
  'read',
  'unread',
]);

export type SourceMetadata =
  | SlackMetadata
  | DiscordMetadata
  | MobileMetadata
  | GhIssuesMetadata
  | null;

export type SlackMetadata = {
  channelId: string;
  threadId: string;
  threadTimestamp: string;
  fileIds?: string[]; // References to gpr_files table
};

export type DiscordMetadata = {
  channelId: string;
  threadId: string;
  threadTimestamp: string;
};

export type MobileMetadata = {
  threadId: string;
};

export type GhIssuesMetadata = {
  issueId: string;
  issueNumber: number;
  issueTitle: string;
  issueBody: string;
};

export const jobs = pgTable(
  'gpr_jobs',
  {
    id: varchar('id', { length: 255 }).notNull(),
    version: integer('version').notNull().default(1),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    generatedName: varchar('generated_name', { length: 500 }),
    generatedDescription: varchar('generated_description', { length: 2000 }),
    status: jobStatusEnum('status').notNull().default('queued'),
    priority: jobPriorityEnum('priority').notNull().default('medium'),
    orderInQueue: integer('order_in_queue').notNull().default(-1),
    queueType: queueTypeEnum('queue_type'),
    agentId: varchar('agent_id', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    updatedBy: varchar('updated_by', { length: 255 }).notNull(),
    codeGenerationLogs: jsonb('code_generation_logs').$type<
      Array<{
        level: 'debug' | 'info' | 'warning' | 'error' | 'fatal';
        timestamp: string; // UTC ISO timestamp
        message: string;
      }>
    >(),
    codeVerificationLogs: jsonb('code_verification_logs').$type<
      Array<{
        level: 'debug' | 'info' | 'warning' | 'error' | 'fatal';
        timestamp: string; // UTC ISO timestamp
        message: string;
      }>
    >(),
    codeGenerationDetailLogs: jsonb('code_generation_detail_logs').$type<
      Array<{
        level: 'debug' | 'info' | 'warning' | 'error' | 'fatal';
        timestamp: string; // UTC ISO timestamp
        message: string;
      }>
    >(),
    userInput: jsonb('user_input').$type<{
      source: 'slack' | 'discord' | 'mobile' | 'gh-issues';
      prompt: string;
      sourceMetadata: SourceMetadata;
    }>(),
    repoId: varchar('repo_id', { length: 255 }),
    userAcceptanceStatus: userAcceptanceStatusEnum('user_acceptance_status')
      .notNull()
      .default('not_reviewed'),
    userComments: jsonb('user_comments').$type<
      Array<{
        file_name: string;
        line_no: number;
        prompt: string;
      }>
    >(),
    confidenceScore: varchar('confidence_score', { length: 50 }),
    prLink: varchar('pr_link', { length: 500 }),
    updates: varchar('updates', { length: 10000 }),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (table: any) => [
    primaryKey({ columns: [table.id, table.version] }),
    index('jobs_org_id_idx').on(table.orgId),
    index('jobs_queue_type_idx').on(
      table.orgId,
      table.queueType,
      table.orderInQueue
    ),
    index('jobs_agent_id_idx').on(table.agentId),
  ]
);

export const repos = pgTable(
  'gpr_repos',
  {
    id: varchar('id', { length: 255 }).notNull().primaryKey(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 2000 }),
    url: varchar('url', { length: 255 }).notNull(),
    repo_provider_id: varchar('repo_provider_id', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (table: any) => [index('repos_org_id_idx').on(table.orgId)]
);

export const repoProviders = pgTable(
  'gpr_repo_providers',
  {
    id: varchar('id', { length: 255 }).notNull().primaryKey(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 2000 }),
    access_token: varchar('access_token', { length: 255 }),
    refresh_token: varchar('refresh_token', { length: 255 }),
    expires_in: integer('expires_in').notNull().default(0),
    token_created_at: timestamp('token_created_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<{
      installation_id?: string;
      app_id?: string;
      [key: string]: unknown;
    }>(),
    repo_provider_app_name: repoProviderAppNameEnum(
      'repo_provider_app_name'
    ).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (table: any) => [index('repo_providers_org_id_idx').on(table.orgId)]
);

export const integrations = pgTable(
  'gpr_integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    providerType: varchar('provider_type', { length: 50 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    providerTeamId: varchar('provider_team_id', { length: 255 }),
    providerUserId: varchar('provider_user_id', { length: 255 }),
    accessToken: varchar('access_token', { length: 2000 }),
    refreshToken: varchar('refresh_token', { length: 2000 }),
    expiresIn: integer('expires_in'),
    tokenCreatedAt: timestamp('token_created_at', { withTimezone: true }),
    managementUrl: varchar('management_url', { length: 500 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (table: any) => [
    index('idx_gpr_integrations_org_id').on(table.orgId),
    index('idx_gpr_integrations_provider_type').on(table.providerType),
    index('idx_gpr_integrations_team').on(table.providerTeamId),
  ]
);

export const activities = pgTable(
  'gpr_activities',
  {
    id: varchar('id', { length: 255 }).notNull().primaryKey(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(), // Short title like "Job Created", "Job Updated", etc.
    jobId: varchar('job_id', { length: 255 }).notNull(),
    agentId: varchar('agent_id', { length: 255 }),
    summary: varchar('summary', { length: 2000 }).notNull(), // Descriptive summary with all details
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: varchar('updated_by', { length: 255 }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    codeGenerationLogs: varchar('code_generation_logs', { length: 1000 }),
    verificationLogs: varchar('verification_logs', { length: 1000 }),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (table: any) => [
    index('activities_job_id_idx').on(table.jobId),
    index('activities_org_id_idx').on(table.orgId),
    index('activities_agent_id_idx').on(table.agentId),
  ]
);

// Separate table for tracking read status per user
export const activityReadStatus = pgTable(
  'gpr_user_activity_read_status',
  {
    id: varchar('id', { length: 255 }).notNull().primaryKey(),
    activityId: varchar('activity_id', { length: 255 }).notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    readStatus: activityReadStatusEnum('read_status')
      .notNull()
      .default('unread'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (table: any) => [
    index('user_activity_read_status_activity_user_idx').on(
      table.activityId,
      table.userId
    ),
    index('user_activity_read_status_org_user_idx').on(
      table.orgId,
      table.userId
    ),
  ]
);

export const files = pgTable(
  'gpr_files',
  {
    id: varchar('id', { length: 255 }).notNull().primaryKey(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    jobId: varchar('job_id', { length: 255 }),
    fileName: varchar('file_name', { length: 500 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }),
    size: integer('size').notNull(),
    gcsPath: varchar('gcs_path', { length: 1000 }).notNull(),
    uploadedBy: varchar('uploaded_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (table: any) => [
    index('files_org_id_idx').on(table.orgId),
    index('files_job_id_idx').on(table.jobId),
  ]
);

export const conversations = pgTable(
  'gpr_conversations',
  {
    id: varchar('id', { length: 255 }).notNull().primaryKey(),
    platform: varchar('platform', { length: 50 }).notNull(),
    channelId: varchar('channel_id', { length: 255 }).notNull(),
    threadId: varchar('thread_id', { length: 255 }),
    userId: varchar('user_id', { length: 255 }).notNull(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    messages: jsonb('messages').$type<
      Array<{
        role: 'user' | 'assistant';
        content: string;
        timestamp: string;
        intent?: string;
      }>
    >(),
    lastMessageAt: timestamp('last_message_at', {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (table: any) => [
    index('conversations_platform_thread_idx').on(
      table.platform,
      table.threadId
    ),
    index('conversations_org_id_idx').on(table.orgId),
    index('conversations_channel_id_idx').on(table.channelId),
  ]
);

export const channelSettings = pgTable(
  'gpr_channel_settings',
  {
    id: varchar('id', { length: 255 }).notNull().primaryKey(),
    platform: varchar('platform', { length: 50 }).notNull(),
    channelId: varchar('channel_id', { length: 255 }).notNull(),
    threadId: varchar('thread_id', { length: 255 }),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    isQuiet: boolean('is_quiet').notNull().default(false),
    quietUntil: timestamp('quiet_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (table: any) => [
    index('channel_settings_lookup_idx').on(
      table.platform,
      table.channelId,
      table.threadId,
      table.orgId
    ),
  ]
);

export const queueStates = pgTable(
  'gpr_queue_states',
  {
    orgId: varchar('org_id', { length: 255 }).notNull(),
    queueType: queueTypeEnum('queue_type').notNull(),
    isPaused: boolean('is_paused').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (table: any) => [
    primaryKey({ columns: [table.orgId, table.queueType] }),
    index('queue_states_org_queue_idx').on(table.orgId, table.queueType),
  ]
);

export const agents = pgTable(
  'gpr_agents',
  {
    id: varchar('id', { length: 255 }).notNull().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    status: agentStatusEnum('status').notNull().default('offline'),
    ip: varchar('ip', { length: 50 }),
    host: varchar('host', { length: 255 }),
    port: integer('port').notNull(),
    vibeAgent: vibeAgentEnum('vibe_agent'),
    vibeAgentExecutablePath: varchar('vibe_agent_executable_path', {
      length: 500,
    }),
    vibeConnectionId: uuid('vibe_connection_id'),
    lastActive: timestamp('last_active', { withTimezone: true }),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    registeredAt: timestamp('registered_at', { withTimezone: true }),
    lastStreamConnectedAt: timestamp('last_stream_connected_at', {
      withTimezone: true,
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (table: any) => [
    index('agents_org_id_idx').on(table.orgId),
    index('agents_status_idx').on(table.status),
    index('agents_org_host_idx').on(table.orgId, table.host),
    index('agents_vibe_connection_id_idx').on(table.vibeConnectionId),
  ]
);

export const queueSchedules = pgTable(
  'gpr_queue_schedules',
  {
    agentId: varchar('agent_id', { length: 255 }).notNull(),
    queueType: queueTypeEnum('queue_type').notNull(),
    scheduleId: varchar('schedule_id', { length: 255 }).notNull(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (table: any) => [
    primaryKey({ columns: [table.agentId, table.queueType] }),
    index('queue_schedules_agent_id_idx').on(table.agentId),
    index('queue_schedules_schedule_id_idx').on(table.scheduleId),
  ]
);

export const apiKeys = pgTable(
  'gpr_api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: varchar('org_id', { length: 255 }).notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    keyPrefix: varchar('key_prefix', { length: 20 }).notNull(),
    keyHash: varchar('key_hash', { length: 255 }).notNull(),
    secretValue: varchar('secret_value', { length: 2000 }).notNull(),
    storageType: varchar('storage_type', { length: 20 }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (table: any) => [
    index('api_keys_org_id_idx').on(table.orgId),
    index('api_keys_user_id_idx').on(table.userId),
    index('api_keys_key_prefix_idx').on(table.keyPrefix),
    index('api_keys_key_hash_idx').on(table.keyHash),
  ]
);

export type Job = InferSelectModel<typeof jobs>;
export type NewJob = InferInsertModel<typeof jobs>;

export type LogEntry = {
  level: 'debug' | 'info' | 'warning' | 'error' | 'fatal';
  timestamp: string; // UTC ISO timestamp
  message: string;
};
export type Repo = InferSelectModel<typeof repos>;
export type NewRepo = InferInsertModel<typeof repos>;
export type RepoProvider = InferSelectModel<typeof repoProviders>;
export type NewRepoProvider = InferInsertModel<typeof repoProviders>;
export type Integration = InferSelectModel<typeof integrations>;
export type NewIntegration = InferInsertModel<typeof integrations>;
export type Activity = InferSelectModel<typeof activities>;
export type NewActivity = InferInsertModel<typeof activities>;
export type ActivityReadStatus = InferSelectModel<typeof activityReadStatus>;
export type NewActivityReadStatus = InferInsertModel<typeof activityReadStatus>;
export type File = InferSelectModel<typeof files>;
export type NewFile = InferInsertModel<typeof files>;
export type Conversation = InferSelectModel<typeof conversations>;
export type NewConversation = InferInsertModel<typeof conversations>;
export type ChannelSettings = InferSelectModel<typeof channelSettings>;
export type NewChannelSettings = InferInsertModel<typeof channelSettings>;
export type QueueState = InferSelectModel<typeof queueStates>;
export type NewQueueState = InferInsertModel<typeof queueStates>;
export type Agent = InferSelectModel<typeof agents>;
export type NewAgent = InferInsertModel<typeof agents>;
export type QueueSchedule = InferSelectModel<typeof queueSchedules>;
export type NewQueueSchedule = InferInsertModel<typeof queueSchedules>;
export type ApiKey = InferSelectModel<typeof apiKeys>;
export type NewApiKey = InferInsertModel<typeof apiKeys>;

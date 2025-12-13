import { Type, Static } from '@sinclair/typebox';

// Convert TypeScript enums to TypeBox enums
const JobStatusSchema = Type.Union([
  Type.Literal('queued'),
  Type.Literal('in-progress'),
  Type.Literal('in-review'),
  Type.Literal('completed'),
  Type.Literal('failed'),
  Type.Literal('archived'),
]);

const JobPrioritySchema = Type.Union([
  Type.Literal('low'),
  Type.Literal('medium'),
  Type.Literal('high'),
]);

const UserInputSourceSchema = Type.Union([
  Type.Literal('slack'),
  Type.Literal('discord'),
  Type.Literal('mobile'),
  Type.Literal('gh-issues'),
]);

const UserAcceptanceStatusSchema = Type.Union([
  Type.Literal('not_reviewed'),
  Type.Literal('reviewed_and_accepted'),
  Type.Literal('reviewed_and_asked_rework'),
  Type.Literal('rejected'),
]);

// Activity read status - per user tracking
const ActivityReadStatusSchema = Type.Union([
  Type.Literal('read'),
  Type.Literal('unread'),
]);

// Define schemas using TypeBox (auto-converts to JSON Schema)
export const UserInputSchema = Type.Object({
  source: UserInputSourceSchema,
  prompt: Type.String(),
  sourceMetadata: Type.Optional(
    Type.Union([
      Type.Object({
        channelId: Type.String(),
        threadId: Type.String(),
        threadTimestamp: Type.String(),
      }),
      Type.Object({
        channelId: Type.String(),
        threadId: Type.String(),
        threadTimestamp: Type.String(),
      }),
      Type.Object({
        threadId: Type.String(),
      }),
      Type.Object({
        issueId: Type.String(),
        issueNumber: Type.Number(),
        issueTitle: Type.String(),
        issueBody: Type.String(),
      }),
      Type.Null(),
    ])
  ),
});

export const UserCommentSchema = Type.Object({
  file_name: Type.String(),
  line_no: Type.Number(),
  prompt: Type.String(),
});

export const CreateJobRequestSchema = Type.Object(
  {
    user_input: UserInputSchema,
    repo: Type.Optional(Type.String()),
    created_by: Type.String(),
  },
  { additionalProperties: false }
);

export const UpdateJobRequestSchema = Type.Object(
  {
    generated_name: Type.Optional(Type.String()),
    generated_description: Type.Optional(Type.String()),
    status: Type.Optional(JobStatusSchema),
    priority: Type.Optional(JobPrioritySchema),
    order_in_queue: Type.Optional(Type.Number()),
    user_input: Type.Optional(UserInputSchema),
    repo: Type.Optional(Type.String()),
    updated_by: Type.String(),
    user_comments: Type.Optional(Type.Array(UserCommentSchema)),
    user_acceptance_status: Type.Optional(UserAcceptanceStatusSchema),
    queue_type: Type.Optional(
      Type.Union([Type.Literal('rework'), Type.Literal('backlog')])
    ),
  },
  { additionalProperties: false }
);

export const JobSchema = Type.Object(
  {
    id: Type.String(),
    version: Type.Number(),
    generated_name: Type.Optional(Type.String()),
    generated_description: Type.Optional(Type.String()),
    status: JobStatusSchema,
    priority: JobPrioritySchema,
    order_in_queue: Type.Number(),
    queue_type: Type.Optional(
      Type.Union([Type.Literal('rework'), Type.Literal('backlog')])
    ),
    created_at: Type.String({ format: 'date-time' }),
    updated_at: Type.String({ format: 'date-time' }),
    created_by: Type.String(),
    updated_by: Type.String(),
    code_generation_logs: Type.Optional(Type.String()),
    code_verification_logs: Type.Optional(Type.String()),
    user_input: Type.Optional(UserInputSchema),
    repo_id: Type.Optional(Type.String()),
    user_acceptance_status: UserAcceptanceStatusSchema,
    user_comments: Type.Optional(Type.Array(UserCommentSchema)),
    confidence_score: Type.Optional(Type.String()),
    pr_link: Type.Optional(Type.String()),
  },
  { additionalProperties: false }
);

export const JobResponseSchema = Type.Object(
  {
    id: Type.String(),
    version: Type.Number(),
    generated_name: Type.Optional(Type.String()),
    generated_description: Type.Optional(Type.String()),
    status: JobStatusSchema,
    priority: JobPrioritySchema,
    order_in_queue: Type.Number(),
    queue_type: Type.Optional(
      Type.Union([Type.Literal('rework'), Type.Literal('backlog')])
    ),
    created_at: Type.String({ format: 'date-time' }),
    updated_at: Type.String({ format: 'date-time' }),
    created_by: Type.String(),
    updated_by: Type.String(),
    code_generation_logs: Type.Optional(Type.String()),
    code_verification_logs: Type.Optional(Type.String()),
    user_input: Type.Optional(UserInputSchema),
    repo_id: Type.Optional(Type.String()),
    repo_url: Type.Optional(Type.String()),
    repo_name: Type.Optional(Type.String()),
    user_acceptance_status: UserAcceptanceStatusSchema,
    user_comments: Type.Optional(Type.Array(UserCommentSchema)),
    confidence_score: Type.Optional(Type.String()),
    pr_link: Type.Optional(Type.String()),
    updates: Type.Optional(Type.String()),
  },
  { additionalProperties: false }
);

export const ErrorResponseSchema = Type.Object(
  {
    error: Type.String(),
  },
  { additionalProperties: false }
);

const RepoProviderAppNameSchema = Type.Union([
  Type.Literal('github'),
  Type.Literal('gitlab'),
  Type.Literal('bitbucket'),
]);

export const RepoSchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    description: Type.Optional(Type.String()),
    url: Type.String(),
    repo_provider_id: Type.String(),
    created_at: Type.String({ format: 'date-time' }),
    updated_at: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false }
);

export const RepoProviderSchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    description: Type.Optional(Type.String()),
    access_token: Type.Optional(Type.String()),
    refresh_token: Type.Optional(Type.String()),
    expires_in: Type.Number(),
    token_created_at: Type.Optional(Type.String({ format: 'date-time' })),
    metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    repo_provider_app_name: RepoProviderAppNameSchema,
    created_at: Type.String({ format: 'date-time' }),
    updated_at: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false }
);

export const RepoProviderTokenSchema = Type.Object(
  {
    access_token: Type.String(),
    refresh_token: Type.Optional(Type.String()),
    expires_in: Type.Number(),
  },
  { additionalProperties: false }
);

export const ConnectGitHubRequestSchema = Type.Object(
  {
    name: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
    use_pat: Type.Optional(Type.String()),
  },
  { additionalProperties: false }
);

export const ConnectGitHubCallbackRequestSchema = Type.Object(
  {
    installation_id: Type.String(),
    setup_action: Type.Optional(Type.String()),
    state: Type.Optional(Type.String()),
  },
  { additionalProperties: false }
);

export const ConnectPATRequestSchema = Type.Object(
  {
    pat: Type.String(),
    name: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
  },
  { additionalProperties: false }
);

export const DisconnectProviderResponseSchema = Type.Object(
  {
    message: Type.String(),
  },
  { additionalProperties: false }
);

export const GetReposResponseSchema = Type.Array(RepoSchema);

export const CreateActivityRequestSchema = Type.Object(
  {
    name: Type.String(), // Short title like "Job Created", "Job Updated"
    job_id: Type.String(),
    summary: Type.String(), // Descriptive summary with all details (required)
    created_by: Type.String(),
    code_generation_logs: Type.Optional(Type.String()),
    verification_logs: Type.Optional(Type.String()),
  },
  { additionalProperties: false }
);

export const UpdateActivityRequestSchema = Type.Object(
  {
    name: Type.Optional(Type.String()),
    summary: Type.Optional(Type.String()),
    updated_by: Type.String(),
    code_generation_logs: Type.Optional(Type.String()),
    verification_logs: Type.Optional(Type.String()),
  },
  { additionalProperties: false }
);

export const UpdateActivityReadStatusRequestSchema = Type.Object(
  {
    is_read: Type.Boolean(),
  },
  { additionalProperties: false }
);

export const UpdateActivityReadStatusResponseSchema = Type.Object(
  {
    message: Type.String(),
    read_status: ActivityReadStatusSchema,
  },
  { additionalProperties: false }
);

export const ActivitySchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(), // Short title
    job_id: Type.String(),
    summary: Type.String(), // Descriptive summary (required)
    created_by: Type.String(),
    created_at: Type.String({ format: 'date-time' }),
    updated_by: Type.String(),
    updated_at: Type.String({ format: 'date-time' }),
    code_generation_logs: Type.Optional(Type.String()),
    verification_logs: Type.Optional(Type.String()),
    read_status: ActivityReadStatusSchema, // Per-user read status
  },
  { additionalProperties: false }
);

export const IntegrationResponseSchema = Type.Object(
  {
    id: Type.String(),
    org_id: Type.String(),
    provider_type: Type.String(),
    name: Type.String(),
    provider_team_id: Type.Union([Type.String(), Type.Null()]),
    provider_user_id: Type.Union([Type.String(), Type.Null()]),
    access_token: Type.String(),
    refresh_token: Type.Union([Type.String(), Type.Null()]),
    expires_in: Type.Union([Type.Number(), Type.Null()]),
    token_created_at: Type.Optional(Type.String({ format: 'date-time' })),
    management_url: Type.Union([Type.String(), Type.Null()]),
    metadata: Type.Record(Type.String(), Type.Unknown()),
    created_at: Type.String({ format: 'date-time' }),
    updated_at: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false }
);

export const ReprioritizeJobRequestSchema = Type.Object(
  {
    position: Type.Number({ description: 'New position in queue (0-based)' }),
  },
  { additionalProperties: false }
);

export const ReprioritizeJobResponseSchema = Type.Object(
  {
    message: Type.String(),
    job: JobResponseSchema,
  },
  { additionalProperties: false }
);

const AgentStatusSchema = Type.Union([
  Type.Literal('active'),
  Type.Literal('idle'),
  Type.Literal('offline'),
]);

export const CreateAgentRequestSchema = Type.Object(
  {
    name: Type.String(),
    host: Type.String(),
    port: Type.Number(),
    ip: Type.Optional(Type.String()),
    status: Type.Optional(AgentStatusSchema),
    vibe_connection_id: Type.Optional(Type.String()),
  },
  { additionalProperties: false }
);

export const UpdateAgentRequestSchema = Type.Object(
  {
    name: Type.Optional(Type.String()),
    host: Type.Optional(Type.String()),
    port: Type.Optional(Type.Number()),
    ip: Type.Optional(Type.String()),
    status: Type.Optional(AgentStatusSchema),
    vibe_connection_id: Type.Optional(Type.String()),
  },
  { additionalProperties: false }
);

export const AgentSchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    org_id: Type.String(),
    status: AgentStatusSchema,
    ip: Type.Optional(Type.String()),
    host: Type.Optional(Type.String()),
    port: Type.Number(),
    vibe_connection_id: Type.Optional(Type.String()),
    vibe_connection: Type.Optional(
      Type.Object({
        id: Type.String(),
        name: Type.String(),
        provider_type: Type.String(),
      })
    ),
    last_active: Type.Optional(Type.String({ format: 'date-time' })),
    created_at: Type.String({ format: 'date-time' }),
    updated_at: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false }
);

const SecretStorageTypeSchema = Type.Union([
  Type.Literal('gcp'),
  Type.Literal('encrypted_local'),
]);

export const StoreIntegrationSecretRequestSchema = Type.Object(
  {
    providerType: Type.String({
      description:
        'The type of integration provider (e.g., cursor, claude-code, kiro-cli)',
    }),
    name: Type.String({
      description: 'A short description/label to help identify the key',
    }),
    apiKey: Type.Optional(
      Type.String({
        description:
          'The API key to store (optional if agent is already authenticated)',
      })
    ),
  },
  { additionalProperties: false }
);

export const StoreIntegrationSecretResponseSchema = Type.Object(
  {
    id: Type.String(),
    providerType: Type.String(),
    name: Type.String(),
    storageType: SecretStorageTypeSchema,
    createdAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false }
);

export const GetIntegrationSecretResponseSchema = Type.Object(
  {
    id: Type.String(),
    providerType: Type.String(),
    name: Type.String(),
    storageType: SecretStorageTypeSchema,
    hasApiKey: Type.Optional(Type.Boolean()),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false }
);

export const GetIntegrationSecretPlaintextResponseSchema = Type.Object(
  {
    apiKey: Type.String(),
  },
  { additionalProperties: false }
);

export const CreateApiKeyRequestSchema = Type.Object(
  {
    name: Type.String({ description: 'A name/label to identify this API key' }),
  },
  { additionalProperties: false }
);

export const CreateApiKeyResponseSchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    keyPrefix: Type.String(),
    apiKey: Type.String({
      description: 'The full API key (only shown once on creation)',
    }),
    createdAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false }
);

export const ApiKeySchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    keyPrefix: Type.String(),
    lastUsedAt: Type.Optional(Type.String({ format: 'date-time' })),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false }
);

export const GetApiKeysResponseSchema = Type.Array(ApiKeySchema);

// Export types for use in routes
export type UserInputType = Static<typeof UserInputSchema>;
export type UserCommentType = Static<typeof UserCommentSchema>;
export type CreateJobRequestType = Static<typeof CreateJobRequestSchema>;
export type UpdateJobRequestType = Static<typeof UpdateJobRequestSchema>;
export type JobType = Static<typeof JobSchema>;
export type ErrorResponseType = Static<typeof ErrorResponseSchema>;
export type RepoType = Static<typeof RepoSchema>;
export type RepoProviderType = Static<typeof RepoProviderSchema>;
export type RepoProviderTokenType = Static<typeof RepoProviderTokenSchema>;
export type ConnectGitHubRequestType = Static<
  typeof ConnectGitHubRequestSchema
>;
export type ConnectGitHubCallbackRequestType = Static<
  typeof ConnectGitHubCallbackRequestSchema
>;
export type ConnectPATRequestType = Static<typeof ConnectPATRequestSchema>;
export type DisconnectProviderResponseType = Static<
  typeof DisconnectProviderResponseSchema
>;
export type GetReposResponseType = Static<typeof GetReposResponseSchema>;
export type CreateActivityRequestType = Static<
  typeof CreateActivityRequestSchema
>;
export type UpdateActivityRequestType = Static<
  typeof UpdateActivityRequestSchema
>;
export type ActivityType = Static<typeof ActivitySchema>;
export type IntegrationResponseType = Static<typeof IntegrationResponseSchema>;
export type ReprioritizeJobRequestType = Static<
  typeof ReprioritizeJobRequestSchema
>;
export type ReprioritizeJobResponseType = Static<
  typeof ReprioritizeJobResponseSchema
>;
export type CreateAgentRequestType = Static<typeof CreateAgentRequestSchema>;
export type UpdateAgentRequestType = Static<typeof UpdateAgentRequestSchema>;
export type AgentType = Static<typeof AgentSchema>;
export type StoreIntegrationSecretRequestType = Static<
  typeof StoreIntegrationSecretRequestSchema
>;
export type StoreIntegrationSecretResponseType = Static<
  typeof StoreIntegrationSecretResponseSchema
>;
export type GetIntegrationSecretResponseType = Static<
  typeof GetIntegrationSecretResponseSchema
>;
export type GetIntegrationSecretPlaintextResponseType = Static<
  typeof GetIntegrationSecretPlaintextResponseSchema
>;
export type CreateApiKeyRequestType = Static<typeof CreateApiKeyRequestSchema>;
export type CreateApiKeyResponseType = Static<
  typeof CreateApiKeyResponseSchema
>;
export type ApiKeyType = Static<typeof ApiKeySchema>;
export type GetApiKeysResponseType = Static<typeof GetApiKeysResponseSchema>;

import { FastifyInstance } from 'fastify';
import {
  UserInputSchema,
  UserCommentSchema,
  CreateJobRequestSchema,
  UpdateJobRequestSchema,
  JobSchema,
  JobResponseSchema,
  ErrorResponseSchema,
  RepoSchema,
  RepoProviderSchema,
  RepoProviderTokenSchema,
  ConnectGitHubRequestSchema,
  ConnectGitHubCallbackRequestSchema,
  ConnectPATRequestSchema,
  DisconnectProviderResponseSchema,
  GetReposResponseSchema,
  CreateActivityRequestSchema,
  UpdateActivityRequestSchema,
  UpdateActivityReadStatusRequestSchema,
  UpdateActivityReadStatusResponseSchema,
  ActivitySchema,
  IntegrationResponseSchema,
  ReprioritizeJobRequestSchema,
  ReprioritizeJobResponseSchema,
  CreateAgentRequestSchema,
  UpdateAgentRequestSchema,
  AgentSchema,
  StoreIntegrationSecretRequestSchema,
  StoreIntegrationSecretResponseSchema,
  GetIntegrationSecretResponseSchema,
  GetIntegrationSecretPlaintextResponseSchema,
  CreateApiKeyRequestSchema,
  CreateApiKeyResponseSchema,
  ApiKeySchema,
  GetApiKeysResponseSchema,
} from '../schemas/index';

export function registerSchemas(fastify: FastifyInstance) {
  // Register base schemas first (dependencies)
  // Register both with and without # to support both Fastify validator and Swagger
  // With beforeAll in tests, this only runs once so no duplicate errors
  fastify.addSchema({ $id: 'UserInput', ...UserInputSchema });
  // fastify.addSchema({ $id: 'UserInput#', ...UserInputSchema });
  fastify.addSchema({ $id: 'UserComment', ...UserCommentSchema });
  // fastify.addSchema({ $id: 'UserComment#', ...UserCommentSchema });

  // Register schemas that depend on base schemas
  fastify.addSchema({ $id: 'CreateJobRequest', ...CreateJobRequestSchema });
  fastify.addSchema({ $id: 'UpdateJobRequest', ...UpdateJobRequestSchema });
  fastify.addSchema({ $id: 'Job', ...JobSchema });
  fastify.addSchema({ $id: 'JobResponse', ...JobResponseSchema });
  fastify.addSchema({ $id: 'ErrorResponse', ...ErrorResponseSchema });
  fastify.addSchema({ $id: 'Repo', ...RepoSchema });
  fastify.addSchema({ $id: 'RepoProvider', ...RepoProviderSchema });
  fastify.addSchema({ $id: 'RepoProviderToken', ...RepoProviderTokenSchema });
  fastify.addSchema({
    $id: 'ConnectGitHubRequest',
    ...ConnectGitHubRequestSchema,
  });
  fastify.addSchema({
    $id: 'ConnectGitHubCallbackRequest',
    ...ConnectGitHubCallbackRequestSchema,
  });
  fastify.addSchema({ $id: 'ConnectPATRequest', ...ConnectPATRequestSchema });
  fastify.addSchema({
    $id: 'DisconnectProviderResponse',
    ...DisconnectProviderResponseSchema,
  });
  fastify.addSchema({ $id: 'GetReposResponse', ...GetReposResponseSchema });
  fastify.addSchema({
    $id: 'CreateActivityRequest',
    ...CreateActivityRequestSchema,
  });
  fastify.addSchema({
    $id: 'UpdateActivityRequest',
    ...UpdateActivityRequestSchema,
  });
  fastify.addSchema({
    $id: 'UpdateActivityReadStatusRequest',
    ...UpdateActivityReadStatusRequestSchema,
  });
  fastify.addSchema({
    $id: 'UpdateActivityReadStatusResponse',
    ...UpdateActivityReadStatusResponseSchema,
  });
  fastify.addSchema({ $id: 'Activity', ...ActivitySchema });
  fastify.addSchema({
    $id: 'IntegrationResponse',
    ...IntegrationResponseSchema,
  });
  fastify.addSchema({
    $id: 'ReprioritizeJobRequest',
    ...ReprioritizeJobRequestSchema,
  });
  fastify.addSchema({
    $id: 'ReprioritizeJobResponse',
    ...ReprioritizeJobResponseSchema,
  });
  fastify.addSchema({ $id: 'CreateAgentRequest', ...CreateAgentRequestSchema });
  fastify.addSchema({ $id: 'UpdateAgentRequest', ...UpdateAgentRequestSchema });
  fastify.addSchema({ $id: 'Agent', ...AgentSchema });
  fastify.addSchema({
    $id: 'StoreIntegrationSecretRequest',
    ...StoreIntegrationSecretRequestSchema,
  });
  fastify.addSchema({
    $id: 'StoreIntegrationSecretResponse',
    ...StoreIntegrationSecretResponseSchema,
  });
  fastify.addSchema({
    $id: 'GetIntegrationSecretResponse',
    ...GetIntegrationSecretResponseSchema,
  });
  fastify.addSchema({
    $id: 'GetIntegrationSecretPlaintextResponse',
    ...GetIntegrationSecretPlaintextResponseSchema,
  });
  fastify.addSchema({
    $id: 'CreateApiKeyRequest',
    ...CreateApiKeyRequestSchema,
  });
  fastify.addSchema({
    $id: 'CreateApiKeyResponse',
    ...CreateApiKeyResponseSchema,
  });
  fastify.addSchema({ $id: 'ApiKey', ...ApiKeySchema });
  fastify.addSchema({ $id: 'GetApiKeysResponse', ...GetApiKeysResponseSchema });
}

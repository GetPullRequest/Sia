import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db, schema, type NewIntegration } from '../db/index';
import { eq, and } from 'drizzle-orm';
import { getCurrentUser, type User } from '../auth';
import { SecretStorageService } from '../services/secrets/secret-storage-service';
import { v4 as uuidv4 } from 'uuid';
import type {
  StoreIntegrationSecretRequestType,
  StoreIntegrationSecretResponseType,
  GetIntegrationSecretResponseType,
} from '../schemas/index';

const { integrations } = schema;

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

async function integrationSecretsRoutes(fastify: FastifyInstance) {
  fastify.log.info('Initializing Integration Secrets routes...');

  const secretStorageService = new SecretStorageService();

  fastify.post<{ Body: StoreIntegrationSecretRequestType }>(
    '/integrations/secrets',
    {
      schema: {
        tags: ['integrations'],
        description: 'Store an integration secret (API key)',
        body: {
          $ref: 'StoreIntegrationSecretRequest#',
        },
        response: {
          201: {
            description: 'Secret stored successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'StoreIntegrationSecretResponse#',
                },
              },
            },
          },
          400: {
            description: 'Bad Request',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          500: {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
        },
      },
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getCurrentUser(request, reply);
        request.user = user;
      },
    },
    async (
      request: FastifyRequest<{ Body: StoreIntegrationSecretRequestType }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { providerType, name, apiKey } = request.body;

        if (!providerType || !name) {
          return reply.code(400).send({
            error: 'providerType and name are required',
          });
        }

        // Validate provider type
        const validProviderTypes = ['cursor', 'claude-code', 'kiro-cli'];
        if (!validProviderTypes.includes(providerType)) {
          return reply.code(400).send({
            error: `Invalid providerType. Must be one of: ${validProviderTypes.join(
              ', '
            )}`,
          });
        }

        // Normalize apiKey to empty string if not provided
        const normalizedApiKey = apiKey || '';
        const hasApiKey = Boolean(apiKey && apiKey.trim().length > 0);

        // Generate a unique secret ID
        const secretId = uuidv4();

        // Store the secret using the secret storage service
        // If apiKey is empty, we still create the integration record
        // (the agent may already be authenticated on the user's machine)
        const { storedValue, storageType } =
          await secretStorageService.storeSecret(secretId, normalizedApiKey);

        // Create integration record in database
        const integrationId = uuidv4();
        const newIntegration: NewIntegration = {
          id: integrationId,
          orgId: user.orgId,
          providerType,
          name,
          accessToken: storedValue, // Store the reference/encrypted value
          metadata: {
            secretStorageType: storageType,
            secretId,
            hasApiKey,
          },
        };

        const [integration] = await db
          .insert(integrations)
          .values(newIntegration)
          .returning();

        fastify.log.info(
          `Stored secret for integration ${integrationId} using ${storageType}`
        );

        const response: StoreIntegrationSecretResponseType = {
          id: integration.id,
          providerType: integration.providerType,
          name: integration.name,
          storageType,
          createdAt: integration.createdAt.toISOString(),
        };

        return reply.code(201).send(response);
      } catch (error) {
        fastify.log.error({ error }, 'Error storing integration secret');
        return reply.code(500).send({
          error:
            error instanceof Error
              ? error.message
              : 'Failed to store integration secret',
        });
      }
    }
  );

  fastify.get<{ Querystring: { providerType?: string } }>(
    '/integrations/secrets',
    {
      schema: {
        tags: ['integrations'],
        description:
          'List all integration secrets for the current organization',
        querystring: {
          type: 'object',
          properties: {
            providerType: {
              type: 'string',
              description:
                'Filter by provider type (e.g., cursor, claude-code, kiro-cli)',
            },
          },
        },
        response: {
          200: {
            description: 'Integration secrets retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: 'GetIntegrationSecretResponse#',
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          500: {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
        },
      },
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getCurrentUser(request, reply);
        request.user = user;
      },
    },
    async (
      request: FastifyRequest<{ Querystring: { providerType?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { providerType } = request.query;

        const whereConditions = [eq(integrations.orgId, user.orgId)];
        if (providerType) {
          whereConditions.push(eq(integrations.providerType, providerType));
        }

        const integrationList = await db
          .select()
          .from(integrations)
          .where(and(...whereConditions));

        const results: GetIntegrationSecretResponseType[] = [];

        for (const integration of integrationList) {
          const metadata = integration.metadata as Record<
            string,
            unknown
          > | null;
          const storageType = metadata?.secretStorageType as
            | 'gcp'
            | 'encrypted_local'
            | undefined;

          if (storageType && integration.accessToken) {
            const hasApiKey = metadata?.hasApiKey as boolean | undefined;
            results.push({
              id: integration.id,
              providerType: integration.providerType,
              name: integration.name,
              storageType,
              hasApiKey,
              createdAt: integration.createdAt.toISOString(),
              updatedAt: integration.updatedAt.toISOString(),
            });
          }
        }

        return reply.code(200).send(results);
      } catch (error) {
        fastify.log.error({ error }, 'Error listing integration secrets');
        return reply.code(500).send({
          error:
            error instanceof Error
              ? error.message
              : 'Failed to list integration secrets',
        });
      }
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/integrations/secrets/:id',
    {
      schema: {
        tags: ['integrations'],
        description: 'Retrieve an integration secret',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'The integration ID',
            },
          },
        },
        response: {
          200: {
            description: 'Integration secret retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'GetIntegrationSecretResponse#',
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          404: {
            description: 'Integration not found',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          500: {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
        },
      },
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getCurrentUser(request, reply);
        request.user = user;
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { id } = request.params;

        // Find the integration
        const [integration] = await db
          .select()
          .from(integrations)
          .where(
            and(eq(integrations.id, id), eq(integrations.orgId, user.orgId))
          )
          .limit(1);

        if (!integration) {
          return reply.code(404).send({
            error: 'Integration not found',
          });
        }

        // Get storage type from metadata
        const metadata = integration.metadata as Record<string, unknown> | null;
        const storageType = metadata?.secretStorageType as
          | 'gcp'
          | 'encrypted_local'
          | undefined;

        if (!storageType || !integration.accessToken) {
          return reply.code(500).send({
            error: 'Integration secret metadata is missing',
          });
        }

        // Retrieve the secret (but don't return it in the response for security)
        // This endpoint is mainly for verifying the secret exists and getting metadata
        // For encrypted_local: accessToken contains the encrypted value
        // For GCP: accessToken contains the full secret name
        await secretStorageService.retrieveSecret(
          integration.accessToken,
          storageType
        );

        const hasApiKey = metadata?.hasApiKey as boolean | undefined;
        const response: GetIntegrationSecretResponseType = {
          id: integration.id,
          providerType: integration.providerType,
          name: integration.name,
          storageType,
          hasApiKey,
          createdAt: integration.createdAt.toISOString(),
          updatedAt: integration.updatedAt.toISOString(),
        };

        return reply.code(200).send(response);
      } catch (error) {
        fastify.log.error({ error }, 'Error retrieving integration secret');
        return reply.code(500).send({
          error:
            error instanceof Error
              ? error.message
              : 'Failed to retrieve integration secret',
        });
      }
    }
  );

  // Endpoint to get the plaintext secret (for internal use or with proper authorization)
  fastify.get<{ Params: { id: string } }>(
    '/integrations/secrets/:id/plaintext',
    {
      schema: {
        tags: ['integrations'],
        description:
          'Retrieve the plaintext API key for an integration (use with caution)',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'The integration ID',
            },
          },
        },
        response: {
          200: {
            description: 'Plaintext secret retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'GetIntegrationSecretPlaintextResponse#',
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          404: {
            description: 'Integration not found',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          500: {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
        },
      },
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getCurrentUser(request, reply);
        request.user = user;
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { id } = request.params;

        // Find the integration
        const [integration] = await db
          .select()
          .from(integrations)
          .where(
            and(eq(integrations.id, id), eq(integrations.orgId, user.orgId))
          )
          .limit(1);

        if (!integration) {
          return reply.code(404).send({
            error: 'Integration not found',
          });
        }

        // Get storage type from metadata
        const metadata = integration.metadata as Record<string, unknown> | null;
        const storageType = metadata?.secretStorageType as
          | 'gcp'
          | 'encrypted_local'
          | undefined;

        if (!storageType || !integration.accessToken) {
          return reply.code(500).send({
            error: 'Integration secret metadata is missing',
          });
        }

        // Retrieve the plaintext secret
        // For encrypted_local: accessToken contains the encrypted value
        // For GCP: accessToken contains the full secret name
        const plaintext = await secretStorageService.retrieveSecret(
          integration.accessToken,
          storageType
        );

        return reply.code(200).send({
          apiKey: plaintext,
        });
      } catch (error) {
        fastify.log.error({ error }, 'Error retrieving plaintext secret');
        return reply.code(500).send({
          error:
            error instanceof Error
              ? error.message
              : 'Failed to retrieve plaintext secret',
        });
      }
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/integrations/secrets/:id',
    {
      schema: {
        tags: ['integrations'],
        description: 'Delete an integration secret (API key)',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'The integration ID',
            },
          },
        },
        response: {
          200: {
            description: 'Integration secret deleted successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'DisconnectProviderResponse#',
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          404: {
            description: 'Integration not found',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          500: {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
        },
      },
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getCurrentUser(request, reply);
        request.user = user;
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { id } = request.params;

        const [integration] = await db
          .select()
          .from(integrations)
          .where(
            and(eq(integrations.id, id), eq(integrations.orgId, user.orgId))
          )
          .limit(1);

        if (!integration) {
          return reply.code(404).send({
            error: 'Integration not found',
          });
        }

        const metadata = integration.metadata as Record<string, unknown> | null;
        const storageType = metadata?.secretStorageType as
          | 'gcp'
          | 'encrypted_local'
          | undefined;
        const secretId = metadata?.secretId as string | undefined;

        if (storageType && secretId) {
          await secretStorageService.deleteSecret(secretId, storageType);
        }

        await db
          .delete(integrations)
          .where(
            and(eq(integrations.id, id), eq(integrations.orgId, user.orgId))
          );

        return reply.code(200).send({
          message: 'Integration secret deleted successfully',
        });
      } catch (error) {
        fastify.log.error({ error }, 'Error deleting integration secret');
        return reply.code(500).send({
          error:
            error instanceof Error
              ? error.message
              : 'Failed to delete integration secret',
        });
      }
    }
  );
}

export default integrationSecretsRoutes;

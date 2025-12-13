import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db, schema, type NewApiKey } from '../db/index';
import { eq, and } from 'drizzle-orm';
import { getCurrentUser, type User } from '../auth';
import { SecretStorageService } from '../services/secrets/secret-storage-service';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import type {
  CreateApiKeyRequestType,
  CreateApiKeyResponseType,
  GetApiKeysResponseType,
} from '../schemas/index';

const { apiKeys } = schema;

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(32);
  return `sia_sk_${randomBytes.toString('base64url')}`;
}

function getKeyPrefix(apiKey: string): string {
  return apiKey.substring(0, 12);
}

function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

async function apiKeysRoutes(fastify: FastifyInstance) {
  fastify.log.info('Initializing API Keys routes...');

  const secretStorageService = new SecretStorageService();

  fastify.post<{ Body: CreateApiKeyRequestType }>(
    '/api-keys',
    {
      schema: {
        tags: ['api-keys'],
        description: 'Create a new API key',
        body: {
          $ref: 'CreateApiKeyRequest#',
        },
        response: {
          201: {
            description: 'API key created successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'CreateApiKeyResponse#',
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
      request: FastifyRequest<{ Body: CreateApiKeyRequestType }>,
      reply: FastifyReply
    ) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        const user = request.user;
        const { name } = request.body;

        if (!name || !name.trim()) {
          return reply.code(400).send({
            error: 'name is required',
          });
        }

        const apiKey = generateApiKey();
        const keyPrefix = getKeyPrefix(apiKey);
        const keyHash = hashApiKey(apiKey);
        const apiKeyId = uuidv4();

        const { storedValue, storageType } =
          await secretStorageService.storeSecret(apiKeyId, apiKey);

        const newApiKey: NewApiKey = {
          id: apiKeyId,
          orgId: user.orgId,
          userId: user.id,
          name: name.trim(),
          keyPrefix,
          keyHash,
          secretValue: storedValue,
          storageType,
        };

        const [createdApiKey] = await db
          .insert(apiKeys)
          .values(newApiKey)
          .returning();

        fastify.log.info(
          `Created API key ${createdApiKey.id} for user ${user.id}`
        );

        const response: CreateApiKeyResponseType = {
          id: createdApiKey.id,
          name: createdApiKey.name,
          keyPrefix: createdApiKey.keyPrefix,
          apiKey,
          createdAt: createdApiKey.createdAt.toISOString(),
        };

        return reply.code(201).send(response);
      } catch (error) {
        fastify.log.error({ error }, 'Error creating API key');
        return reply.code(500).send({
          error:
            error instanceof Error ? error.message : 'Failed to create API key',
        });
      }
    }
  );

  fastify.get(
    '/api-keys',
    {
      schema: {
        tags: ['api-keys'],
        description: 'Get all API keys for the current user',
        response: {
          200: {
            description: 'List of API keys',
            content: {
              'application/json': {
                schema: {
                  $ref: 'GetApiKeysResponse#',
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        const user = request.user;

        const userApiKeys = await db
          .select()
          .from(apiKeys)
          .where(
            and(eq(apiKeys.orgId, user.orgId), eq(apiKeys.userId, user.id))
          )
          .orderBy(apiKeys.createdAt);

        const response: GetApiKeysResponseType = userApiKeys.map(key => ({
          id: key.id,
          name: key.name,
          keyPrefix: key.keyPrefix,
          lastUsedAt: key.lastUsedAt?.toISOString(),
          createdAt: key.createdAt.toISOString(),
          updatedAt: key.updatedAt.toISOString(),
        }));

        return reply.code(200).send(response);
      } catch (error) {
        fastify.log.error({ error }, 'Error fetching API keys');
        return reply.code(500).send({
          error:
            error instanceof Error ? error.message : 'Failed to fetch API keys',
        });
      }
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/api-keys/:id',
    {
      schema: {
        tags: ['api-keys'],
        description: 'Delete an API key',
        params: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The ID of the API key to delete',
            },
          },
          required: ['id'],
        },
        response: {
          204: {
            description: 'API key deleted successfully',
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
            description: 'API key not found',
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
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        const user = request.user;
        const { id } = request.params;

        const [apiKey] = await db
          .select()
          .from(apiKeys)
          .where(
            and(
              eq(apiKeys.id, id),
              eq(apiKeys.orgId, user.orgId),
              eq(apiKeys.userId, user.id)
            )
          )
          .limit(1);

        if (!apiKey) {
          return reply.code(404).send({
            error: 'API key not found',
          });
        }

        await secretStorageService.deleteSecret(
          apiKey.secretValue,
          apiKey.storageType as 'gcp' | 'encrypted_local'
        );

        await db.delete(apiKeys).where(eq(apiKeys.id, id));

        fastify.log.info(`Deleted API key ${id} for user ${user.id}`);

        return reply.code(204).send();
      } catch (error) {
        fastify.log.error({ error }, 'Error deleting API key');
        return reply.code(500).send({
          error:
            error instanceof Error ? error.message : 'Failed to delete API key',
        });
      }
    }
  );
}

export default apiKeysRoutes;

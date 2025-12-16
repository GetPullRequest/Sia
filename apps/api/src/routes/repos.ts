import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  repoConfigService,
  type CreateRepoConfigDto,
} from '../services/repo-config.service.js';
import { repoInferenceService } from '../services/repo-inference.service.js';
import { getCurrentUser, type User } from '../auth/index.js';
import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';

const { repos } = schema;

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

interface GetConfigParams {
  repoId: string;
}

interface SaveConfigParams {
  repoId: string;
}

type SaveConfigBody = Omit<CreateRepoConfigDto, 'repoId'>;

// Helper function to transform RepoConfig from DB to API response format
function transformRepoConfig(config: any) {
  if (!config) return null;

  return {
    id: config.id,
    repoId: config.repoId,
    orgId: config.orgId,
    executionStrategy: config.executionStrategy || undefined,
    setupCommands: config.setupCommands || undefined,
    buildCommands: config.buildCommands || undefined,
    testCommands: config.testCommands || undefined,
    validationStrategy: config.validationStrategy || undefined,
    envVarsNeeded: config.envVarsNeeded || undefined,
    detectedLanguage: config.detectedLanguage || undefined,
    detectedFrom: config.detectedFrom || undefined,
    devcontainerConfig: config.devcontainerConfig || undefined,
    isConfirmed: config.isConfirmed,
    inferredAt: config.inferredAt ? config.inferredAt.toISOString() : undefined,
    confirmedAt: config.confirmedAt
      ? config.confirmedAt.toISOString()
      : undefined,
    inferenceSource: config.inferenceSource || undefined,
    inferenceConfidence: config.inferenceConfidence || undefined,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}

export default async function reposRoutes(fastify: FastifyInstance) {
  /**
   * GET /repos/:repoId/config
   * Get repository configuration
   */
  fastify.get<{
    Params: GetConfigParams;
  }>(
    '/:repoId/config',
    {
      schema: {
        tags: ['repos'],
        description: 'Get repository configuration',
        params: {
          type: 'object',
          properties: {
            repoId: { type: 'string' },
          },
          required: ['repoId'],
        },
        response: {
          200: {
            description: 'Repository configuration',
            content: {
              'application/json': {
                schema: {
                  $ref: 'RepoConfig#',
                },
              },
            },
          },
          401: {
            $ref: 'ErrorResponse#',
          },
          500: {
            $ref: 'ErrorResponse#',
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: GetConfigParams }>,
      reply: FastifyReply
    ) => {
      const user = await getCurrentUser(request, reply);
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { repoId } = request.params;

      try {
        const config = await repoConfigService.getConfig(repoId);
        return reply.status(200).send(transformRepoConfig(config));
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to get repository configuration',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * POST /repos/:repoId/config
   * Save or update repository configuration
   */
  fastify.post<{
    Params: SaveConfigParams;
    Body: SaveConfigBody;
  }>(
    '/:repoId/config',
    async (
      request: FastifyRequest<{
        Params: SaveConfigParams;
        Body: SaveConfigBody;
      }>,
      reply: FastifyReply
    ) => {
      const user = await getCurrentUser(request, reply);
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { repoId } = request.params;
      const body = request.body;

      try {
        const config = await repoConfigService.saveConfig({
          repoId,
          ...body,
        });

        return reply.status(200).send(transformRepoConfig(config));
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to save repository configuration',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * DELETE /repos/:repoId/config
   * Delete repository configuration (revert to auto-detect)
   */
  fastify.delete<{
    Params: GetConfigParams;
  }>(
    '/:repoId/config',
    async (
      request: FastifyRequest<{ Params: GetConfigParams }>,
      reply: FastifyReply
    ) => {
      const user = await getCurrentUser(request, reply);
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { repoId } = request.params;

      try {
        await repoConfigService.deleteConfig(repoId);
        return reply.status(200).send({ success: true });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to delete repository configuration',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /repos/org/:orgId/configs
   * Get all repository configurations for an organization
   */
  fastify.get<{
    Params: { orgId: string };
  }>(
    '/org/:orgId/configs',
    async (
      request: FastifyRequest<{ Params: { orgId: string } }>,
      reply: FastifyReply
    ) => {
      const user = await getCurrentUser(request, reply);
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { orgId } = request.params;

      // Verify user has access to this org
      if (user.orgId !== orgId) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      try {
        const configs = await repoConfigService.getConfigsForOrg(orgId);
        return reply.status(200).send(configs.map(transformRepoConfig));
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to get organization configurations',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * POST /repos/:repoId/config/confirm
   * Mark configuration as confirmed (with optional edits)
   */
  fastify.post<{
    Params: { repoId: string };
    Body: {
      setupCommands?: string[];
      buildCommands?: string[];
      testCommands?: string[];
    };
  }>(
    '/:repoId/config/confirm',
    {
      schema: {
        tags: ['repos'],
        description: 'Confirm repository configuration',
        params: {
          type: 'object',
          properties: {
            repoId: { type: 'string' },
          },
          required: ['repoId'],
        },
        body: {
          $ref: 'ConfirmRepoConfigRequest#',
        },
        response: {
          200: {
            description: 'Configuration confirmed',
            content: {
              'application/json': {
                schema: {
                  $ref: 'RepoConfig#',
                },
              },
            },
          },
          401: {
            $ref: 'ErrorResponse#',
          },
          404: {
            $ref: 'ErrorResponse#',
          },
          500: {
            $ref: 'ErrorResponse#',
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { repoId: string };
        Body: {
          setupCommands?: string[];
          buildCommands?: string[];
          testCommands?: string[];
        };
      }>,
      reply: FastifyReply
    ) => {
      const user = await getCurrentUser(request, reply);
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { repoId } = request.params;

      try {
        // Get existing config
        const config = await repoConfigService.getConfig(repoId);
        if (!config) {
          return reply.status(404).send({ error: 'Config not found' });
        }

        // Update config with user edits (if any) and mark as confirmed
        const updatedConfig = await repoConfigService.saveConfig({
          repoId,
          orgId: user.orgId,
          setupCommands:
            request.body.setupCommands ?? (config.setupCommands || undefined),
          buildCommands:
            request.body.buildCommands ?? (config.buildCommands || undefined),
          testCommands:
            request.body.testCommands ?? (config.testCommands || undefined),
          isConfirmed: true,
          confirmedAt: new Date(),
        });

        return reply.status(200).send(transformRepoConfig(updatedConfig));
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to confirm repository configuration',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * POST /repos/:repoId/config/re-infer
   * Trigger manual re-inference for a repository
   */
  fastify.post<{
    Params: { repoId: string };
  }>(
    '/:repoId/config/re-infer',
    {
      schema: {
        tags: ['repos'],
        description: 'Re-infer repository configuration',
        params: {
          type: 'object',
          properties: {
            repoId: { type: 'string' },
          },
          required: ['repoId'],
        },
        response: {
          200: {
            description: 'Configuration re-inferred',
            content: {
              'application/json': {
                schema: {
                  $ref: 'RepoConfig#',
                },
              },
            },
          },
          401: {
            $ref: 'ErrorResponse#',
          },
          500: {
            $ref: 'ErrorResponse#',
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { repoId: string } }>,
      reply: FastifyReply
    ) => {
      const user = await getCurrentUser(request, reply);
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { repoId } = request.params;

      try {
        // Trigger re-inference
        await repoInferenceService.reInferConfigForRepo(repoId, user.orgId);

        // Return updated config
        const config = await repoConfigService.getConfig(repoId);
        return reply.status(200).send(transformRepoConfig(config));
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to re-infer repository configuration',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /repos
   * Get all repos with their configurations
   */
  fastify.get(
    '/',
    {
      schema: {
        tags: ['repos'],
        description: 'Get all repositories with configurations',
        response: {
          200: {
            description: 'List of repositories with configurations',
            content: {
              'application/json': {
                schema: {
                  $ref: 'GetReposWithConfigsResponse#',
                },
              },
            },
          },
          401: {
            $ref: 'ErrorResponse#',
          },
          500: {
            $ref: 'ErrorResponse#',
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await getCurrentUser(request, reply);
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      try {
        const reposList = await db
          .select()
          .from(repos)
          .where(eq(repos.orgId, user.orgId));

        const reposWithConfigs = await Promise.all(
          reposList.map(async repo => {
            const config = await repoConfigService.getConfig(repo.id);
            return {
              id: repo.id,
              name: repo.name,
              description: repo.description,
              url: repo.url,
              repo_provider_id: repo.repo_provider_id,
              created_at: repo.createdAt.toISOString(),
              updated_at: repo.updatedAt.toISOString(),
              config: transformRepoConfig(config),
            };
          })
        );

        return reply.status(200).send(reposWithConfigs);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to fetch repos',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * PATCH /repos/:id
   * Update repo description
   */
  fastify.patch<{ Params: { id: string }; Body: { description?: string } }>(
    '/:id',
    {
      schema: {
        tags: ['repos'],
        description: 'Update repository description',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        body: {
          $ref: 'UpdateRepoDescriptionRequest#',
        },
        response: {
          200: {
            description: 'Repository updated',
            content: {
              'application/json': {
                schema: {
                  $ref: 'RepoWithConfig#',
                },
              },
            },
          },
          401: {
            $ref: 'ErrorResponse#',
          },
          404: {
            $ref: 'ErrorResponse#',
          },
          500: {
            $ref: 'ErrorResponse#',
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { description?: string };
      }>,
      reply: FastifyReply
    ) => {
      const user = await getCurrentUser(request, reply);
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params;
      const { description } = request.body;

      try {
        const repo = await db
          .select()
          .from(repos)
          .where(and(eq(repos.id, id), eq(repos.orgId, user.orgId)))
          .limit(1);

        if (!repo[0]) {
          return reply.status(404).send({ error: 'Repo not found' });
        }

        const updatedRepo = await db
          .update(repos)
          .set({
            description:
              description !== undefined ? description : repo[0].description,
            updatedAt: new Date(),
          })
          .where(and(eq(repos.id, id), eq(repos.orgId, user.orgId)))
          .returning();

        const config = await repoConfigService.getConfig(id);

        return reply.status(200).send({
          id: updatedRepo[0].id,
          name: updatedRepo[0].name,
          description: updatedRepo[0].description,
          url: updatedRepo[0].url,
          repo_provider_id: updatedRepo[0].repo_provider_id,
          created_at: updatedRepo[0].createdAt.toISOString(),
          updated_at: updatedRepo[0].updatedAt.toISOString(),
          config: transformRepoConfig(config),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to update repo',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );
}

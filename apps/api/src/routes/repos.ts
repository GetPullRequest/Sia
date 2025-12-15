import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  repoConfigService,
  type CreateRepoConfigDto,
} from '../services/repo-config.service.js';
import { getCurrentUser, type User } from '../auth/index.js';

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

export default async function reposRoutes(fastify: FastifyInstance) {
  /**
   * GET /repos/:repoId/config
   * Get repository configuration
   */
  fastify.get<{
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
        const config = await repoConfigService.getConfig(repoId);
        return reply.status(200).send(config);
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

        return reply.status(200).send(config);
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
        return reply.status(200).send(configs);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Failed to get organization configurations',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );
}

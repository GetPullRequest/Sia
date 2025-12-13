import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db, schema, type Agent, type NewAgent } from '../db/index';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { CreateAgentRequest, UpdateAgentRequest } from '../types';
import { getCurrentUser, type User } from '../auth';
import { queueWorkflowService } from '../services/queue-workflow-service';
import { initializeScheduleForAgent } from '../services/queue-initialization';

const { agents, integrations } = schema;

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

async function transformAgentResponse(agent: Agent) {
  let vibeConnection = null;

  // Fetch vibe connection details if vibeConnectionId exists
  if (agent.vibeConnectionId) {
    const [connection] = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, agent.vibeConnectionId))
      .limit(1);

    if (connection) {
      vibeConnection = {
        id: connection.id,
        name: connection.name,
        provider_type: connection.providerType,
      };
    }
  }

  return {
    id: agent.id,
    name: agent.name,
    org_id: agent.orgId,
    status: agent.status,
    ip: agent.ip ?? undefined,
    host: agent.host ?? undefined,
    port: agent.port,
    vibe_connection_id: agent.vibeConnectionId ?? undefined,
    vibe_connection: vibeConnection,
    last_active: agent.lastActive?.toISOString() ?? undefined,
    created_at: agent.createdAt.toISOString(),
    updated_at: agent.updatedAt.toISOString(),
  };
}

async function agentsRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: CreateAgentRequest }>(
    '/agents',
    {
      schema: {
        tags: ['agents'],
        description: 'Create a new agent',
        body: {
          $ref: 'CreateAgentRequest#',
        },
        response: {
          201: {
            description: 'Agent created successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'Agent#',
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
      request: FastifyRequest<{ Body: CreateAgentRequest }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { name, host, port, ip, status, vibe_connection_id } =
          request.body;

        if (!name || !host || !port) {
          return reply.code(400).send({
            error: 'name, host, and port are required',
          });
        }

        const agentId = `agent-${uuidv4()}`;
        const newAgent: NewAgent = {
          id: agentId,
          name,
          orgId: user.orgId,
          status: status || 'offline',
          host,
          port,
          ip: ip || null,
          vibeConnectionId:
            vibe_connection_id && vibe_connection_id.trim() !== ''
              ? vibe_connection_id
              : null,
          lastActive: null,
        };

        const createdAgentResult = await db
          .insert(agents)
          .values(newAgent)
          .returning();
        const createdAgent = createdAgentResult[0];

        // If agent is created as active, start schedule
        if (createdAgent.status === 'active') {
          try {
            await queueWorkflowService.startAgentSchedules(agentId);
            // Also initialize in database (for tracking)
            await initializeScheduleForAgent(agentId, user.orgId);
          } catch (error) {
            fastify.log.warn(
              { error },
              `Failed to start schedule for agent ${agentId}`
            );
            // Don't fail the request, schedule can be started later
          }
        }

        return reply.code(201).send(await transformAgentResponse(createdAgent));
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to create agent' });
      }
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/agents/:id',
    {
      schema: {
        tags: ['agents'],
        description: 'Get an agent by ID',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Agent retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'Agent#',
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
            description: 'Agent not found',
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

        const agentResult = await db
          .select()
          .from(agents)
          .where(and(eq(agents.id, id), eq(agents.orgId, user.orgId)))
          .limit(1);

        if (!agentResult[0]) {
          return reply.code(404).send({ error: 'Agent not found' });
        }

        return reply.send(await transformAgentResponse(agentResult[0]));
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to fetch agent' });
      }
    }
  );

  fastify.get(
    '/agents',
    {
      schema: {
        tags: ['agents'],
        description: 'List all agents',
        response: {
          200: {
            description: 'List of agents',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: 'Agent#',
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user!;
        const allAgents = await db
          .select()
          .from(agents)
          .where(eq(agents.orgId, user.orgId))
          .orderBy(desc(agents.createdAt));

        const transformedAgents = await Promise.all(
          allAgents.map(agent => transformAgentResponse(agent))
        );

        return reply.send(transformedAgents);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to fetch agents' });
      }
    }
  );

  fastify.put<{ Params: { id: string }; Body: UpdateAgentRequest }>(
    '/agents/:id',
    {
      schema: {
        tags: ['agents'],
        description: 'Update an agent',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          $ref: 'UpdateAgentRequest#',
        },
        response: {
          200: {
            description: 'Agent updated successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'Agent#',
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
            description: 'Agent not found',
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
      request: FastifyRequest<{
        Params: { id: string };
        Body: UpdateAgentRequest;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { id } = request.params;
        const { name, host, port, ip, status, vibe_connection_id } =
          request.body;

        const currentAgentResult = await db
          .select()
          .from(agents)
          .where(and(eq(agents.id, id), eq(agents.orgId, user.orgId)))
          .limit(1);

        if (!currentAgentResult[0]) {
          return reply.code(404).send({ error: 'Agent not found' });
        }

        const currentAgent = currentAgentResult[0];
        const previousStatus = currentAgent.status;

        const updateData: Partial<Agent> = {
          updatedAt: new Date(),
        };

        if (name !== undefined) updateData.name = name;
        if (host !== undefined) updateData.host = host;
        if (port !== undefined) updateData.port = port;
        if (ip !== undefined) updateData.ip = ip;
        if (status !== undefined) updateData.status = status;
        if (vibe_connection_id !== undefined) {
          // Convert empty string to null, otherwise use the provided value
          updateData.vibeConnectionId =
            vibe_connection_id && vibe_connection_id.trim() !== ''
              ? vibe_connection_id
              : null;
        }

        const updatedAgentResult = await db
          .update(agents)
          .set(updateData)
          .where(and(eq(agents.id, id), eq(agents.orgId, user.orgId)))
          .returning();

        const updatedAgent = updatedAgentResult[0];

        // Handle status changes: start/pause schedules
        if (status !== undefined && status !== previousStatus) {
          try {
            if (status === 'active' && previousStatus !== 'active') {
              // Agent became active: start schedule
              await queueWorkflowService.startAgentSchedules(id);
              // Also initialize in database (for tracking)
              await initializeScheduleForAgent(id, user.orgId);
            } else if (status !== 'active' && previousStatus === 'active') {
              // Agent became inactive/offline: pause schedule
              await queueWorkflowService.pauseAgentSchedules(id);
            }
          } catch (error) {
            fastify.log.warn(
              { error },
              `Failed to update schedule for agent ${id}`
            );
            // Don't fail the request, schedules can be updated later
          }
        }

        return reply.send(await transformAgentResponse(updatedAgent));
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to update agent' });
      }
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/agents/:id',
    {
      schema: {
        tags: ['agents'],
        description: 'Delete an agent',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Agent deleted successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'Agent#',
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
            description: 'Agent not found',
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

        const currentAgentResult = await db
          .select()
          .from(agents)
          .where(and(eq(agents.id, id), eq(agents.orgId, user.orgId)))
          .limit(1);

        if (!currentAgentResult[0]) {
          return reply.code(404).send({ error: 'Agent not found' });
        }

        // Delete schedule before deleting agent
        try {
          const scheduleId = `queue-schedule-${id}`;
          await queueWorkflowService.deleteSchedule(scheduleId);
        } catch (error) {
          fastify.log.warn(
            { error },
            `Failed to delete schedule for agent ${id}`
          );
          // Continue with agent deletion even if schedule deletion fails
        }

        // Delete agent
        const deletedAgentResult = await db
          .delete(agents)
          .where(and(eq(agents.id, id), eq(agents.orgId, user.orgId)))
          .returning();

        return reply.send(await transformAgentResponse(deletedAgentResult[0]));
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to delete agent' });
      }
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/agents/:id/reconnect',
    {
      schema: {
        tags: ['agents'],
        description:
          'Reconnect an offline agent - attempts to ping the agent and resume schedule if successful',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Reconnection attempt completed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                    agent: { $ref: 'Agent#' },
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
          404: {
            description: 'Agent not found',
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

        const currentAgentResult = await db
          .select()
          .from(agents)
          .where(and(eq(agents.id, id), eq(agents.orgId, user.orgId)))
          .limit(1);

        if (!currentAgentResult[0]) {
          return reply.code(404).send({ error: 'Agent not found' });
        }

        const currentAgent = currentAgentResult[0];

        // Import the ping activity
        const { pingAgentViaStream } = await import(
          '../temporal/activities/ping-agent-via-stream-activity'
        );

        // Attempt to ping the agent
        const pingResult = await pingAgentViaStream({ agentId: id });

        if (pingResult.success) {
          // Agent is alive - reset consecutive failures and mark as active
          const updatedAgentResult = await db
            .update(agents)
            .set({
              status: 'active',
              consecutiveFailures: 0,
              lastActive: new Date(),
              updatedAt: new Date(),
            })
            .where(and(eq(agents.id, id), eq(agents.orgId, user.orgId)))
            .returning();

          const updatedAgent = updatedAgentResult[0];

          // Resume the schedule
          try {
            await queueWorkflowService.resumeAgentSchedules(id);
          } catch (error) {
            fastify.log.warn(
              { error },
              `Failed to resume schedule for agent ${id}`
            );
          }

          return reply.send({
            success: true,
            message: 'Agent reconnected successfully',
            agent: await transformAgentResponse(updatedAgent),
          });
        } else {
          // Agent is still not responding
          return reply.send({
            success: false,
            message: `Failed to reconnect: ${
              pingResult.error || 'Agent not responding'
            }`,
            agent: await transformAgentResponse(currentAgent),
          });
        }
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to reconnect agent' });
      }
    }
  );
}

export default agentsRoutes;

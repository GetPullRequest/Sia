import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db, schema, type Agent, type NewAgent } from '../db/index';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { CreateAgentRequest, UpdateAgentRequest } from '../types';
import { getCurrentUser, type User } from '../auth';
import { queueWorkflowService } from '../services/queue-workflow-service';
import { initializeScheduleForAgent } from '../services/queue-initialization';

const { agents } = schema;

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

function transformAgentResponse(agent: Agent) {
  return {
    id: agent.id,
    name: agent.name,
    org_id: agent.orgId,
    status: agent.status,
    ip: agent.ip ?? undefined,
    host: agent.host ?? undefined,
    port: agent.port,
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
    async (request: FastifyRequest<{ Body: CreateAgentRequest }>, reply: FastifyReply) => {
      try {
        const user = request.user!;
        const { name, host, port, ip, status } = request.body;

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
          lastActive: null,
        };

        const createdAgentResult = await db.insert(agents).values(newAgent).returning();
        const createdAgent = createdAgentResult[0];

        // If agent is created as active, start schedule
        if (createdAgent.status === 'active') {
          try {
            await queueWorkflowService.startAgentSchedules(agentId);
            // Also initialize in database (for tracking)
            await initializeScheduleForAgent(agentId, user.orgId);
          } catch (error) {
            fastify.log.warn({ error }, `Failed to start schedule for agent ${agentId}`);
            // Don't fail the request, schedule can be started later
          }
        }

        return reply.code(201).send(transformAgentResponse(createdAgent));
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
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
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

        return reply.send(transformAgentResponse(agentResult[0]));
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

        return reply.send(allAgents.map(transformAgentResponse));
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
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateAgentRequest }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { id } = request.params;
        const { name, host, port, ip, status } = request.body;

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
            fastify.log.warn({ error }, `Failed to update schedule for agent ${id}`);
            // Don't fail the request, schedules can be updated later
          }
        }

        return reply.send(transformAgentResponse(updatedAgent));
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
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
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
          fastify.log.warn({ error }, `Failed to delete schedule for agent ${id}`);
          // Continue with agent deletion even if schedule deletion fails
        }

        // Delete agent
        const deletedAgentResult = await db
          .delete(agents)
          .where(and(eq(agents.id, id), eq(agents.orgId, user.orgId)))
          .returning();

        return reply.send(transformAgentResponse(deletedAgentResult[0]));
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to delete agent' });
      }
    }
  );
}

export default agentsRoutes;


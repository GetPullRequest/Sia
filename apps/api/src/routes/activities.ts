import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db, schema, type Activity, type NewActivity } from '../db/index';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type {
  CreateActivityRequest,
  UpdateActivityRequest,
  UpdateActivityReadStatusRequest,
} from '../types';
import { getCurrentUser, type User } from '../auth';

const { activities, jobs, activityReadStatus } = schema;

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

function transformActivityResponse(
  activity: Activity,
  readStatus: 'read' | 'unread' = 'unread'
) {
  return {
    id: activity.id,
    name: activity.name,
    job_id: activity.jobId,
    summary: activity.summary,
    created_by: activity.createdBy,
    created_at: activity.createdAt.toISOString(),
    updated_by: activity.updatedBy,
    updated_at: activity.updatedAt.toISOString(),
    code_generation_logs: activity.codeGenerationLogs ?? undefined,
    verification_logs: activity.verificationLogs ?? undefined,
    read_status: readStatus,
  };
}

async function activitiesRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: CreateActivityRequest }>(
    '/activities',
    {
      schema: {
        tags: ['activities'],
        description: 'Create a new activity',
        body: {
          $ref: 'CreateActivityRequest#',
        },
        response: {
          201: {
            description: 'Activity created successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'Activity#',
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
          404: {
            description: 'Job not found',
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
      request: FastifyRequest<{ Body: CreateActivityRequest }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const {
          name,
          job_id,
          summary,
          created_by,
          code_generation_logs,
          verification_logs,
        } = request.body;

        if (!name) {
          return reply.code(400).send({
            error: 'name is required',
          });
        }

        if (!job_id) {
          return reply.code(400).send({
            error: 'job_id is required',
          });
        }

        if (!summary) {
          return reply.code(400).send({
            error: 'summary is required',
          });
        }

        const jobResult = await db
          .select()
          .from(jobs)
          .where(and(eq(jobs.id, job_id), eq(jobs.orgId, user.orgId)))
          .orderBy(desc(jobs.version))
          .limit(1);

        if (!jobResult[0]) {
          return reply.code(404).send({ error: 'Job not found' });
        }

        const activityId = uuidv4();
        const newActivity: NewActivity = {
          id: activityId,
          orgId: user.orgId,
          name,
          jobId: job_id,
          summary,
          createdBy: created_by,
          updatedBy: created_by,
          codeGenerationLogs: code_generation_logs ?? null,
          verificationLogs: verification_logs ?? null,
        };

        const createdActivityResult = await db
          .insert(activities)
          .values(newActivity)
          .returning();

        // Don't create read status entry here - it will be created when user views the activity
        // This way, new users joining the org will see all old activities as unread
        return reply
          .code(201)
          .send(transformActivityResponse(createdActivityResult[0], 'unread'));
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to create activity' });
      }
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/activities/:id',
    {
      schema: {
        tags: ['activities'],
        description: 'Get an activity by ID',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Activity retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'Activity#',
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
            description: 'Activity not found',
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

        const activityResult = await db
          .select()
          .from(activities)
          .where(eq(activities.id, id))
          .limit(1);
        const activity = activityResult[0] as Activity | undefined;

        if (!activity) {
          return reply.code(404).send({ error: 'Activity not found' });
        }

        const jobResult = await db
          .select()
          .from(jobs)
          .where(and(eq(jobs.id, activity.jobId), eq(jobs.orgId, user.orgId)))
          .orderBy(desc(jobs.version))
          .limit(1);

        if (!jobResult[0]) {
          return reply.code(404).send({ error: 'Activity not found' });
        }

        // Fetch read status for this user
        const readStatusResult = await db
          .select()
          .from(activityReadStatus)
          .where(
            and(
              eq(activityReadStatus.activityId, id),
              eq(activityReadStatus.userId, user.id),
              eq(activityReadStatus.orgId, user.orgId)
            )
          )
          .limit(1);

        const readStatus = readStatusResult[0]?.readStatus ?? 'unread';

        return reply.send(transformActivityResponse(activity, readStatus));
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to fetch activity' });
      }
    }
  );

  fastify.get<{ Querystring: { job_id?: string } }>(
    '/activities',
    {
      schema: {
        tags: ['activities'],
        description: 'List all activities',
        querystring: {
          type: 'object',
          properties: {
            job_id: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'List of activities',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: 'Activity#',
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
      request: FastifyRequest<{ Querystring: { job_id?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { job_id } = request.query;

        let allActivities;

        if (job_id) {
          const jobResult = await db
            .select()
            .from(jobs)
            .where(and(eq(jobs.id, job_id), eq(jobs.orgId, user.orgId)))
            .orderBy(desc(jobs.version))
            .limit(1);

          if (!jobResult[0]) {
            return reply.code(404).send({ error: 'Job not found' });
          }

          allActivities = await db
            .select()
            .from(activities)
            .where(
              and(
                eq(activities.jobId, job_id),
                eq(activities.orgId, user.orgId)
              )
            )
            .orderBy(desc(activities.createdAt));
        } else {
          const userJobIds = await db
            .select({ id: jobs.id })
            .from(jobs)
            .where(eq(jobs.orgId, user.orgId));

          const jobIds = userJobIds.map(j => j.id);

          if (jobIds.length === 0) {
            return reply.send([]);
          }

          allActivities = await db
            .select()
            .from(activities)
            .where(
              and(
                inArray(activities.jobId, jobIds),
                eq(activities.orgId, user.orgId)
              )
            )
            .orderBy(desc(activities.createdAt));
        }

        // Fetch read status for all activities for this user
        const activityIds = allActivities.map(a => a.id);
        const readStatuses =
          activityIds.length > 0
            ? await db
                .select()
                .from(activityReadStatus)
                .where(
                  and(
                    inArray(activityReadStatus.activityId, activityIds),
                    eq(activityReadStatus.userId, user.id),
                    eq(activityReadStatus.orgId, user.orgId)
                  )
                )
            : [];

        const readStatusMap = new Map(
          readStatuses.map(rs => [rs.activityId, rs.readStatus])
        );

        return reply.send(
          allActivities.map(activity =>
            transformActivityResponse(
              activity,
              readStatusMap.get(activity.id) ?? 'unread'
            )
          )
        );
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to fetch activities' });
      }
    }
  );

  fastify.put<{ Params: { id: string }; Body: UpdateActivityRequest }>(
    '/activities/:id',
    {
      schema: {
        tags: ['activities'],
        description: 'Update an activity',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          $ref: 'UpdateActivityRequest#',
        },
        response: {
          200: {
            description: 'Activity updated successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'Activity#',
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
            description: 'Activity not found',
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
        Body: UpdateActivityRequest;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { id } = request.params;
        const {
          name,
          summary,
          updated_by,
          code_generation_logs,
          verification_logs,
        } = request.body;

        const activityResult = await db
          .select()
          .from(activities)
          .where(and(eq(activities.id, id), eq(activities.orgId, user.orgId)))
          .limit(1);
        const currentActivity = activityResult[0] as Activity | undefined;

        if (!currentActivity) {
          return reply.code(404).send({ error: 'Activity not found' });
        }

        const updateData: Partial<Activity> = {
          updatedBy: updated_by,
          updatedAt: new Date(),
        };

        if (name !== undefined) updateData.name = name;
        if (summary !== undefined) updateData.summary = summary;
        if (code_generation_logs !== undefined)
          updateData.codeGenerationLogs = code_generation_logs;
        if (verification_logs !== undefined)
          updateData.verificationLogs = verification_logs;

        const updatedActivityResult = await db
          .update(activities)
          .set(updateData)
          .where(and(eq(activities.id, id), eq(activities.orgId, user.orgId)))
          .returning();

        // Fetch read status for this user
        const readStatusResult = await db
          .select()
          .from(activityReadStatus)
          .where(
            and(
              eq(activityReadStatus.activityId, id),
              eq(activityReadStatus.userId, user.id),
              eq(activityReadStatus.orgId, user.orgId)
            )
          )
          .limit(1);

        const readStatus = readStatusResult[0]?.readStatus ?? 'unread';

        return reply.send(
          transformActivityResponse(updatedActivityResult[0], readStatus)
        );
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to update activity' });
      }
    }
  );

  fastify.put<{
    Params: { id: string };
    Body: UpdateActivityReadStatusRequest;
  }>(
    '/activities/:id/read-status',
    {
      schema: {
        tags: ['activities'],
        description: 'Update activity read status',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          $ref: 'UpdateActivityReadStatusRequest#',
        },
        response: {
          200: {
            description: 'Read status updated successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'UpdateActivityReadStatusResponse#',
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
            description: 'Activity not found',
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
        Body: UpdateActivityReadStatusRequest;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { id } = request.params;
        const { is_read } = request.body;

        // Verify activity exists and belongs to user's org
        const activityResult = await db
          .select()
          .from(activities)
          .where(and(eq(activities.id, id), eq(activities.orgId, user.orgId)))
          .limit(1);

        if (!activityResult[0]) {
          return reply.code(404).send({ error: 'Activity not found' });
        }

        // Check if read status entry exists
        const existingReadStatus = await db
          .select()
          .from(activityReadStatus)
          .where(
            and(
              eq(activityReadStatus.activityId, id),
              eq(activityReadStatus.userId, user.id),
              eq(activityReadStatus.orgId, user.orgId)
            )
          )
          .limit(1);

        const readStatus = is_read ? 'read' : 'unread';

        if (existingReadStatus[0]) {
          // Update existing read status
          await db
            .update(activityReadStatus)
            .set({
              readStatus,
              updatedAt: new Date(),
            })
            .where(eq(activityReadStatus.id, existingReadStatus[0].id));
        } else {
          // Create new read status entry
          const readStatusId = uuidv4();
          await db.insert(activityReadStatus).values({
            id: readStatusId,
            activityId: id,
            userId: user.id,
            orgId: user.orgId,
            readStatus,
          });
        }

        return reply.send({
          message: 'Read status updated successfully',
          read_status: readStatus,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to update read status' });
      }
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/activities/:id',
    {
      schema: {
        tags: ['activities'],
        description: 'Delete an activity',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Activity deleted successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'Activity#',
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
            description: 'Activity not found',
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

        const activityResult = await db
          .select()
          .from(activities)
          .where(and(eq(activities.id, id), eq(activities.orgId, user.orgId)))
          .limit(1);
        const activity = activityResult[0] as Activity | undefined;

        if (!activity) {
          return reply.code(404).send({ error: 'Activity not found' });
        }

        const deletedActivityResult = await db
          .delete(activities)
          .where(and(eq(activities.id, id), eq(activities.orgId, user.orgId)))
          .returning();

        // Also delete all read status records for this activity
        await db
          .delete(activityReadStatus)
          .where(eq(activityReadStatus.activityId, id));

        return reply.send(
          transformActivityResponse(deletedActivityResult[0], 'unread')
        );
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to delete activity' });
      }
    }
  );
}

export default activitiesRoutes;

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  db,
  schema,
  type Job,
  type NewJob,
  type NewActivity,
} from '../db/index';
import { eq, and, desc, asc, sql, inArray, gt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type {
  CreateJobRequest,
  UpdateJobRequest,
  ReprioritizeJobRequest,
} from '../types';
import { jobExecutionService } from '../services/job-execution';
import { queueWorkflowService } from '../services/queue-workflow-service';
import { getCurrentUser, type User } from '../auth';
import { generateJobTitleAndDescription } from '../services/job-title-generator';

const { jobs, repos, activities } = schema;

type QueueType = 'rework' | 'backlog';

// Get jobs in a specific queue
async function getQueueJobs(orgId: string, queueType: QueueType) {
  return await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.orgId, orgId),
        eq(jobs.status, 'queued'),
        eq(jobs.queueType, queueType)
      )
    )
    .orderBy(asc(jobs.orderInQueue));
}

// Get next position in a queue
async function getNextQueuePosition(
  orgId: string,
  queueType: QueueType
): Promise<number> {
  const queueJobs = await getQueueJobs(orgId, queueType);
  return queueJobs.length;
}

// Reprioritize queue after removing a job
async function reprioritizeQueueAfterRemoval(
  orgId: string,
  queueType: QueueType,
  removedPosition: number
) {
  await db
    .update(jobs)
    .set({
      orderInQueue: sql`${jobs.orderInQueue} - 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(jobs.orgId, orgId),
        eq(jobs.status, 'queued'),
        eq(jobs.queueType, queueType),
        gt(jobs.orderInQueue, removedPosition)
      )
    );
}

// Remove job from queue (set to null and -1)
async function removeJobFromQueue(
  jobId: string,
  orgId: string,
  version: number,
  userId: string
) {
  await db
    .update(jobs)
    .set({
      queueType: null,
      orderInQueue: -1,
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(
      and(eq(jobs.id, jobId), eq(jobs.version, version), eq(jobs.orgId, orgId))
    );
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

// Helper function to create activity with descriptive summary
async function createActivity(
  jobId: string,
  name: string,
  summary: string,
  userId: string,
  orgId: string,
  codeGenerationLogs?: string,
  verificationLogs?: string
): Promise<void> {
  try {
    const activityId = uuidv4();
    const newActivity: NewActivity = {
      id: activityId,
      orgId,
      name,
      jobId,
      summary,
      createdBy: userId,
      updatedBy: userId,
      codeGenerationLogs: codeGenerationLogs ?? null,
      verificationLogs: verificationLogs ?? null,
    };

    await db.insert(activities).values(newActivity);
  } catch (error) {
    // Log error but don't fail the main operation
    console.error('Failed to create activity:', error);
  }
}

function transformJobResponse(
  job: Job,
  repoMap?: Map<string, { id: string; url: string; name: string }>
) {
  let repoInfo: { repo_id?: string; repo_url?: string; repo_name?: string } =
    {};

  if (job.repoId) {
    if (repoMap && repoMap.has(job.repoId)) {
      const repo = repoMap.get(job.repoId);
      if (repo) {
        repoInfo = {
          repo_id: repo.id,
          repo_url: repo.url,
          repo_name: repo.name,
        };
      }
    } else {
      // If not found in map, treat repoId as the repo identifier (could be owner/repo format)
      repoInfo = {
        repo_id: job.repoId,
        repo_url: job.repoId.startsWith('http')
          ? job.repoId
          : `https://github.com/${job.repoId}`,
        repo_name: job.repoId.includes('/')
          ? job.repoId.split('/').pop()
          : job.repoId,
      };
    }
  }

  return {
    id: job.id,
    version: job.version,
    generated_name: job.generatedName ?? undefined,
    generated_description: job.generatedDescription ?? undefined,
    status: job.status,
    priority: job.priority,
    order_in_queue: job.orderInQueue,
    queue_type: job.queueType ?? undefined,
    created_at: job.createdAt.toISOString(),
    updated_at: job.updatedAt.toISOString(),
    created_by: job.createdBy,
    updated_by: job.updatedBy,
    code_generation_logs: job.codeGenerationLogs ?? undefined,
    code_verification_logs: job.codeVerificationLogs ?? undefined,
    user_input: job.userInput ?? undefined,
    repo_id: repoInfo.repo_id,
    repo_url: repoInfo.repo_url,
    repo_name: repoInfo.repo_name,
    user_acceptance_status: job.userAcceptanceStatus,
    user_comments: job.userComments ?? undefined,
    confidence_score: job.confidenceScore ?? undefined,
    pr_link: job.prLink ?? undefined,
    updates: job.updates ?? undefined,
  };
}

async function jobsRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: CreateJobRequest }>(
    '/jobs',
    {
      schema: {
        tags: ['jobs'],
        description: 'Create a new job',
        body: {
          $ref: 'CreateJobRequest#',
        },
        response: {
          201: {
            description: 'Job created successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'JobResponse#',
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
      request: FastifyRequest<{ Body: CreateJobRequest }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { user_input, repo, created_by } = request.body;

        if (!user_input || !user_input.source || !user_input.prompt) {
          return reply.code(400).send({
            error: 'user_input with source and prompt is required',
          });
        }

        // Generate title and description from task description
        const { title, description } = await generateJobTitleAndDescription(
          user_input.prompt
        );

        // Get next position in backlog queue
        const nextBacklogPosition = await getNextQueuePosition(
          user.orgId,
          'backlog'
        );

        const jobId = `job-${uuidv4()}`;
        const newJob: NewJob = {
          id: jobId,
          version: 1,
          orgId: user.orgId,
          generatedName: title,
          generatedDescription: description,
          userInput: {
            source: user_input.source,
            prompt: user_input.prompt,
            sourceMetadata: user_input.sourceMetadata ?? null,
          },
          repoId: repo || null,
          createdBy: created_by,
          updatedBy: created_by,
          status: 'queued',
          priority: 'medium',
          queueType: 'backlog',
          orderInQueue: nextBacklogPosition,
        };

        const createdJobResult = await db
          .insert(jobs)
          .values(newJob)
          .returning();
        const createdJob = createdJobResult[0];

        // Fetch repo if repoId exists
        let repoMap:
          | Map<string, { id: string; url: string; name: string }>
          | undefined;
        let repoInfo = '';
        if (createdJob.repoId) {
          const repo = await db
            .select()
            .from(repos)
            .where(
              and(eq(repos.id, createdJob.repoId), eq(repos.orgId, user.orgId))
            )
            .limit(1);
          if (repo.length > 0) {
            repoMap = new Map([
              [
                repo[0].id,
                { id: repo[0].id, url: repo[0].url, name: repo[0].name },
              ],
            ]);
            repoInfo = ` in repository ${repo[0].name}`;
          }
        }

        // Create activity for job creation
        const jobName = createdJob.generatedName || 'Untitled Job';
        const activitySummary = `Job "${jobName}" was created${repoInfo} by ${
          created_by || user.id
        }. Priority: ${createdJob.priority}, Status: ${
          createdJob.status
        }, Queue: ${createdJob.queueType || 'none'}.`;
        await createActivity(
          createdJob.id,
          'Job Created',
          activitySummary,
          created_by || user.id,
          user.orgId
        );

        return reply.code(201).send(transformJobResponse(createdJob, repoMap));
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to create job' });
      }
    }
  );

  fastify.get<{ Params: { id: string }; Querystring: { version?: string } }>(
    '/jobs/:id',
    {
      schema: {
        tags: ['jobs'],
        description: 'Get a job by ID',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            version: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Job retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'JobResponse#',
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
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { version?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { id } = request.params;
        const { version } = request.query;

        let job: Job | undefined;

        if (version) {
          const result = await db
            .select()
            .from(jobs)
            .where(
              and(
                eq(jobs.id, id),
                eq(jobs.version, parseInt(version)),
                eq(jobs.orgId, user.orgId)
              )
            )
            .limit(1);
          job = result[0] as Job | undefined;
        } else {
          const result = await db
            .select()
            .from(jobs)
            .where(and(eq(jobs.id, id), eq(jobs.orgId, user.orgId)))
            .orderBy(desc(jobs.version))
            .limit(1);
          job = result[0] as Job | undefined;
        }

        if (!job) {
          return reply.code(404).send({ error: 'Job not found' });
        }

        // Fetch repo if repoId exists
        let repoMap:
          | Map<string, { id: string; url: string; name: string }>
          | undefined;
        if (job.repoId) {
          const repo = await db
            .select()
            .from(repos)
            .where(and(eq(repos.id, job.repoId), eq(repos.orgId, user.orgId)))
            .limit(1);
          if (repo.length > 0) {
            repoMap = new Map([
              [
                repo[0].id,
                { id: repo[0].id, url: repo[0].url, name: repo[0].name },
              ],
            ]);
          }
        }

        return reply.send(transformJobResponse(job, repoMap));
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to fetch job' });
      }
    }
  );

  fastify.get(
    '/jobs',
    {
      schema: {
        tags: ['jobs'],
        description: 'List all jobs',
        response: {
          200: {
            description: 'List of jobs',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: 'JobResponse#',
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

        // Get only the latest version of each job using DISTINCT ON
        // This PostgreSQL-specific feature efficiently gets the latest version per job id
        const allJobsResult = await db.execute(sql`
          SELECT DISTINCT ON (id) 
            id, version, org_id, generated_name, generated_description, status, priority,
            order_in_queue, queue_type, created_at, updated_at, created_by, updated_by,
            code_generation_logs, code_verification_logs, code_generation_detail_logs, user_input, repo_id,
            user_acceptance_status, user_comments, confidence_score, pr_link, updates
          FROM ${jobs}
          WHERE org_id = ${user.orgId}
          ORDER BY id, version DESC
        `);

        // Map the raw SQL results (snake_case) to Job type (camelCase)
        const allJobs: Job[] = allJobsResult.rows.map(
          (row: Record<string, unknown>) => ({
            id: row.id as string,
            version: row.version as number,
            orgId: row.org_id as string,
            generatedName: row.generated_name as string | null,
            generatedDescription: row.generated_description as string | null,
            status: row.status as Job['status'],
            priority: row.priority as Job['priority'],
            orderInQueue: row.order_in_queue as number,
            queueType: row.queue_type as 'rework' | 'backlog' | null,
            agentId: row.agent_id as string | null,
            createdAt: new Date(row.created_at as string | number | Date),
            updatedAt: new Date(row.updated_at as string | number | Date),
            createdBy: row.created_by as string,
            updatedBy: row.updated_by as string,
            codeGenerationLogs: (() => {
              const logs = row.code_generation_logs;
              if (!logs) return null;
              if (typeof logs === 'string') {
                // Try to parse as JSON, fallback to null if invalid
                try {
                  return JSON.parse(logs) as Job['codeGenerationLogs'];
                } catch {
                  return null; // Invalid JSON, return null
                }
              }
              return logs as Job['codeGenerationLogs'];
            })(),
            codeVerificationLogs: (() => {
              const logs = row.code_verification_logs;
              if (!logs) return null;
              if (typeof logs === 'string') {
                try {
                  return JSON.parse(logs) as Job['codeVerificationLogs'];
                } catch {
                  return null;
                }
              }
              return logs as Job['codeVerificationLogs'];
            })(),
            codeGenerationDetailLogs: (() => {
              const logs = row.code_generation_detail_logs;
              if (!logs) return null;
              if (typeof logs === 'string') {
                try {
                  return JSON.parse(logs) as Job['codeGenerationDetailLogs'];
                } catch {
                  return null;
                }
              }
              return logs as Job['codeGenerationDetailLogs'];
            })(),
            userInput: row.user_input as Job['userInput'],
            repoId: row.repo_id as string | null,
            userAcceptanceStatus:
              row.user_acceptance_status as Job['userAcceptanceStatus'],
            userComments: row.user_comments as Job['userComments'],
            confidenceScore: row.confidence_score as string | null,
            prLink: row.pr_link as string | null,
            updates: row.updates as string | null,
          })
        );

        // Sort by createdAt descending
        allJobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        // Fetch all repos for jobs that have repoId
        const repoIds = allJobs
          .map(job => job.repoId)
          .filter((id): id is string => id !== null);
        const repoMap = new Map<
          string,
          { id: string; url: string; name: string }
        >();

        if (repoIds.length > 0) {
          const allRepos = await db
            .select()
            .from(repos)
            .where(
              and(eq(repos.orgId, user.orgId), inArray(repos.id, repoIds))
            );

          allRepos.forEach(repo => {
            repoMap.set(repo.id, {
              id: repo.id,
              url: repo.url,
              name: repo.name,
            });
          });
        }

        return reply.send(
          allJobs.map(job => transformJobResponse(job, repoMap))
        );
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to fetch jobs' });
      }
    }
  );

  fastify.put<{ Params: { id: string }; Body: UpdateJobRequest }>(
    '/jobs/:id',
    {
      schema: {
        tags: ['jobs'],
        description: 'Update a job',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          $ref: 'UpdateJobRequest#',
        },
        response: {
          200: {
            description: 'Job updated successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'JobResponse#',
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
      request: FastifyRequest<{
        Params: { id: string };
        Body: UpdateJobRequest;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { id } = request.params;
        const {
          generated_name,
          generated_description,
          status,
          priority,
          order_in_queue,
          user_input,
          repo,
          updated_by,
          user_comments,
          user_acceptance_status,
          queue_type,
        } = request.body;

        const currentJobResult = await db
          .select()
          .from(jobs)
          .where(and(eq(jobs.id, id), eq(jobs.orgId, user.orgId)))
          .orderBy(desc(jobs.version))
          .limit(1);
        const currentJob = currentJobResult[0] as Job | undefined;

        if (!currentJob) {
          return reply.code(404).send({ error: 'Job not found' });
        }

        // Check if user_input prompt has changed
        const promptChanged =
          user_input &&
          user_input.prompt &&
          user_input.prompt !== currentJob.userInput?.prompt;

        // Generate new title and description if prompt changed
        let autoGeneratedTitle: string | undefined;
        let autoGeneratedDescription: string | undefined;
        if (promptChanged) {
          const generated = await generateJobTitleAndDescription(
            user_input.prompt
          );
          autoGeneratedTitle = generated.title;
          autoGeneratedDescription = generated.description;
        }

        // Check if this is a retry (queue_type is rework and has new comments)
        const isRetry =
          status === 'queued' &&
          queue_type === 'rework' &&
          user_comments &&
          user_comments.length > (currentJob.userComments?.length || 0);

        const needsNewVersion =
          (user_input &&
            JSON.stringify(user_input) !==
              JSON.stringify(currentJob.userInput)) ||
          (repo !== undefined && repo !== currentJob.repoId) ||
          (user_acceptance_status === 'reviewed_and_asked_rework' &&
            currentJob.userAcceptanceStatus !== 'reviewed_and_asked_rework') ||
          isRetry;

        // Block moving job from queue to in-progress (not supported)
        // Queue jobs are automatically processed by the Temporal workflow system
        if (
          status !== undefined &&
          status === 'in-progress' &&
          currentJob.status === 'queued'
        ) {
          return reply.code(400).send({
            error:
              'Cannot move job from queue to in-progress. Queue jobs are processed automatically by the system.',
          });
        }

        // Handle status change to in-review: remove from queue
        if (
          status !== undefined &&
          status === 'in-review' &&
          currentJob.status !== 'in-review'
        ) {
          // If job was in a queue, remove it and reprioritize
          if (currentJob.status === 'queued' && currentJob.queueType) {
            await reprioritizeQueueAfterRemoval(
              user.orgId,
              currentJob.queueType,
              currentJob.orderInQueue
            );
          }
        }

        // Handle user_acceptance_status change to rework: move to rework queue
        let reworkOrderInQueue = currentJob.orderInQueue;
        let targetQueueType: QueueType | null = null;

        if (
          user_acceptance_status === 'reviewed_and_asked_rework' &&
          currentJob.userAcceptanceStatus !== 'reviewed_and_asked_rework'
        ) {
          // If job was in backlog queue, remove it
          if (
            currentJob.status === 'queued' &&
            currentJob.queueType === 'backlog'
          ) {
            await reprioritizeQueueAfterRemoval(
              user.orgId,
              'backlog',
              currentJob.orderInQueue
            );
          }

          // Move to rework queue
          reworkOrderInQueue = await getNextQueuePosition(user.orgId, 'rework');
          targetQueueType = 'rework';
        }

        // Handle user_acceptance_status change from rework to not_reviewed: move to backlog
        if (
          user_acceptance_status === 'not_reviewed' &&
          currentJob.userAcceptanceStatus === 'reviewed_and_asked_rework' &&
          currentJob.status === 'queued'
        ) {
          // Remove from rework queue
          if (currentJob.queueType === 'rework') {
            await reprioritizeQueueAfterRemoval(
              user.orgId,
              'rework',
              currentJob.orderInQueue
            );
          }

          // Move to backlog queue
          const nextBacklogPosition = await getNextQueuePosition(
            user.orgId,
            'backlog'
          );
          reworkOrderInQueue = nextBacklogPosition;
          targetQueueType = 'backlog';
        }

        // Handle status change back to queued (if it was in a different state)
        if (
          status !== undefined &&
          status === 'queued' &&
          currentJob.status !== 'queued'
        ) {
          // Determine which queue based on userAcceptanceStatus
          const targetQueue: QueueType =
            currentJob.userAcceptanceStatus === 'reviewed_and_asked_rework'
              ? 'rework'
              : 'backlog';

          const nextPosition = await getNextQueuePosition(
            user.orgId,
            targetQueue
          );
          reworkOrderInQueue = nextPosition;
          targetQueueType = targetQueue;
        }

        if (needsNewVersion) {
          const newVersion = currentJob.version + 1;

          // Determine queue state for new version
          const newStatus = status ?? currentJob.status;
          let newQueueType: QueueType | null = null;
          let newOrderInQueue = -1;

          if (newStatus === 'queued') {
            // Job is queued - determine queue type
            if (queue_type) {
              // Use provided queue_type
              newQueueType = queue_type;
              newOrderInQueue = await getNextQueuePosition(
                user.orgId,
                queue_type
              );
            } else {
              const finalUserAcceptanceStatus =
                user_acceptance_status ?? currentJob.userAcceptanceStatus;
              newQueueType =
                finalUserAcceptanceStatus === 'reviewed_and_asked_rework'
                  ? 'rework'
                  : 'backlog';
              newOrderInQueue = targetQueueType
                ? reworkOrderInQueue
                : await getNextQueuePosition(user.orgId, newQueueType);
            }
          } else if (
            status !== undefined &&
            (status === 'in-progress' || status === 'in-review')
          ) {
            // Job is being moved out of queue
            newQueueType = null;
            newOrderInQueue = -1;
          } else {
            // Keep existing queue state if not changing
            newQueueType = currentJob.queueType;
            newOrderInQueue = currentJob.orderInQueue;
          }

          // Build updates message for status changes
          let newUpdates = currentJob.updates || null;
          if (status !== undefined && status !== currentJob.status) {
            const timestamp = new Date().toLocaleString();
            let updateMessage = '';

            if (status === 'failed') {
              updateMessage = `Job execution failed at ${timestamp}.`;
            } else if (status === 'completed') {
              updateMessage = `Job completed successfully at ${timestamp}.`;
            } else if (status === 'in-review') {
              updateMessage = `Job moved to review state at ${timestamp}.`;
            } else if (status === 'in-progress') {
              updateMessage = `Job execution started at ${timestamp}.`;
            } else if (status === 'queued') {
              // Check if this is a retry (queue_type is rework and has comments)
              const isRetryForUpdate =
                queue_type === 'rework' &&
                user_comments &&
                user_comments.length > (currentJob.userComments?.length || 0);
              if (isRetryForUpdate) {
                const latestComment = user_comments[user_comments.length - 1];
                const commentText = latestComment.prompt?.trim();
                if (commentText && commentText !== 'No comment provided') {
                  updateMessage = `User retried the job at ${timestamp} and added a comment: "${commentText}". Job is now waiting to be scheduled in the rework queue.`;
                } else {
                  updateMessage = `User retried the job at ${timestamp}. Job is now waiting to be scheduled in the rework queue.`;
                }
              } else {
                updateMessage = `Job queued at ${timestamp}.`;
              }
            } else {
              updateMessage = `Job status changed from ${currentJob.status} to ${status} at ${timestamp}.`;
            }

            newUpdates = currentJob.updates
              ? `${currentJob.updates}\n${updateMessage}`
              : updateMessage;
          }

          const newJob: NewJob = {
            id: id,
            version: newVersion,
            orgId: currentJob.orgId,
            // Use auto-generated title/description if prompt changed, otherwise use provided or existing
            generatedName:
              generated_name ??
              (promptChanged ? autoGeneratedTitle : currentJob.generatedName) ??
              null,
            generatedDescription:
              generated_description ??
              (promptChanged
                ? autoGeneratedDescription
                : currentJob.generatedDescription) ??
              null,
            status: newStatus,
            priority: priority ?? currentJob.priority,
            orderInQueue:
              order_in_queue !== undefined ? order_in_queue : newOrderInQueue,
            queueType: newQueueType,
            userInput: user_input
              ? {
                  source: user_input.source,
                  prompt: user_input.prompt,
                  sourceMetadata: user_input.sourceMetadata ?? null,
                }
              : currentJob.userInput ?? null,
            repoId: repo !== undefined ? repo : currentJob.repoId ?? null,
            createdBy: currentJob.createdBy,
            updatedBy: updated_by,
            // Exclude code generation and verification logs when retrying
            codeGenerationLogs: isRetry
              ? null
              : currentJob.codeGenerationLogs ?? null,
            codeVerificationLogs: isRetry
              ? null
              : currentJob.codeVerificationLogs ?? null,
            userAcceptanceStatus:
              user_acceptance_status ?? currentJob.userAcceptanceStatus,
            userComments: user_comments ?? currentJob.userComments ?? null,
            confidenceScore: currentJob.confidenceScore ?? null,
            prLink: currentJob.prLink ?? null,
            updates: newUpdates,
          };

          const createdJobResult = await db
            .insert(jobs)
            .values(newJob)
            .returning();
          const updatedJob = createdJobResult[0];

          // Fetch repo if repoId exists
          let repoMap:
            | Map<string, { id: string; url: string; name: string }>
            | undefined;
          let repoInfo = '';
          if (updatedJob.repoId) {
            const repo = await db
              .select()
              .from(repos)
              .where(
                and(
                  eq(repos.id, updatedJob.repoId),
                  eq(repos.orgId, user.orgId)
                )
              )
              .limit(1);
            if (repo.length > 0) {
              repoMap = new Map([
                [
                  repo[0].id,
                  { id: repo[0].id, url: repo[0].url, name: repo[0].name },
                ],
              ]);
              repoInfo = ` in repository ${repo[0].name}`;
            }
          }

          // Create activity for job update with version change
          const jobName = updatedJob.generatedName || 'Untitled Job';
          const changes: string[] = [];
          if (promptChanged) changes.push('user input prompt');
          if (repo !== undefined && repo !== currentJob.repoId)
            changes.push('repository');
          if (user_acceptance_status === 'reviewed_and_asked_rework')
            changes.push('moved to rework queue');
          if (status !== undefined && status !== currentJob.status)
            changes.push(
              `status changed from ${currentJob.status} to ${status}`
            );
          if (priority !== undefined && priority !== currentJob.priority)
            changes.push(
              `priority changed from ${currentJob.priority} to ${priority}`
            );

          const changesText =
            changes.length > 0 ? ` Changes: ${changes.join(', ')}.` : '';
          const activitySummary = `Job "${jobName}" (version ${
            updatedJob.version
          }) was updated${repoInfo} by ${
            updated_by || user.id
          }.${changesText} Job version updated from ${currentJob.version} to ${
            updatedJob.version
          }.`;
          await createActivity(
            updatedJob.id,
            'Job Updated',
            activitySummary,
            updated_by || user.id,
            user.orgId
          );

          return reply.send(transformJobResponse(updatedJob, repoMap));
        } else {
          const updateData: Partial<Job> = {
            updatedBy: updated_by,
            updatedAt: new Date(),
          };

          // Use auto-generated title/description if prompt changed, otherwise use provided values
          if (promptChanged) {
            updateData.generatedName = generated_name ?? autoGeneratedTitle;
            updateData.generatedDescription =
              generated_description ?? autoGeneratedDescription;
          } else {
            if (generated_name !== undefined)
              updateData.generatedName = generated_name;
            if (generated_description !== undefined)
              updateData.generatedDescription = generated_description;
          }
          if (status !== undefined) {
            updateData.status = status;
            // Handle queue state based on status change
            if (status === 'in-progress' || status === 'in-review') {
              // Remove from queue
              updateData.queueType = null;
              updateData.orderInQueue = -1;
            } else if (status === 'queued') {
              // Add to appropriate queue
              if (queue_type) {
                // Use provided queue_type
                const nextPosition = await getNextQueuePosition(
                  user.orgId,
                  queue_type
                );
                updateData.queueType = queue_type;
                updateData.orderInQueue = nextPosition;
              } else if (targetQueueType) {
                updateData.queueType = targetQueueType;
                updateData.orderInQueue = reworkOrderInQueue;
              } else {
                // Determine queue based on current userAcceptanceStatus
                const finalUserAcceptanceStatus =
                  user_acceptance_status ?? currentJob.userAcceptanceStatus;
                const queueType: QueueType =
                  finalUserAcceptanceStatus === 'reviewed_and_asked_rework'
                    ? 'rework'
                    : 'backlog';
                const nextPosition = await getNextQueuePosition(
                  user.orgId,
                  queueType
                );
                updateData.queueType = queueType;
                updateData.orderInQueue = nextPosition;
              }
            }

            // Add update message for status changes
            if (status !== currentJob.status) {
              const existingUpdates = currentJob.updates || '';
              const timestamp = new Date().toLocaleString();
              let updateMessage = '';

              if (status === 'failed') {
                updateMessage = `Job execution failed at ${timestamp}.`;
              } else if (status === 'completed') {
                updateMessage = `Job completed successfully at ${timestamp}.`;
              } else if (status === 'in-review') {
                updateMessage = `Job moved to review state at ${timestamp}.`;
              } else if (status === 'in-progress') {
                updateMessage = `Job execution started at ${timestamp}.`;
              } else if (status === 'queued') {
                // Check if this is a retry (queue_type is rework and has comments)
                const isRetry =
                  queue_type === 'rework' &&
                  user_comments &&
                  user_comments.length > (currentJob.userComments?.length || 0);
                if (isRetry) {
                  const latestComment = user_comments[user_comments.length - 1];
                  const commentText = latestComment.prompt?.trim();
                  if (commentText && commentText !== 'No comment provided') {
                    updateMessage = `User retried the job at ${timestamp} and added a comment: "${commentText}". Job is now waiting to be scheduled in the rework queue.`;
                  } else {
                    updateMessage = `User retried the job at ${timestamp}. Job is now waiting to be scheduled in the rework queue.`;
                  }
                } else {
                  updateMessage = `Job queued at ${timestamp}.`;
                }
              } else {
                updateMessage = `Job status changed from ${currentJob.status} to ${status} at ${timestamp}.`;
              }

              // Prepend new updates (latest first)
              updateData.updates = updateMessage
                ? existingUpdates
                  ? `${updateMessage}\n${existingUpdates}`
                  : updateMessage
                : existingUpdates;
            }
          }
          if (priority !== undefined) updateData.priority = priority;
          if (order_in_queue !== undefined)
            updateData.orderInQueue = order_in_queue;
          if (user_comments !== undefined)
            updateData.userComments = user_comments;
          if (user_acceptance_status !== undefined) {
            updateData.userAcceptanceStatus = user_acceptance_status;
            // Handle queue changes based on user_acceptance_status
            if (targetQueueType !== null && currentJob.status === 'queued') {
              updateData.queueType = targetQueueType;
              updateData.orderInQueue = reworkOrderInQueue;
            }
          }

          const updatedJobResult = await db
            .update(jobs)
            .set(updateData)
            .where(
              and(
                eq(jobs.id, id),
                eq(jobs.version, currentJob.version),
                eq(jobs.orgId, user.orgId)
              )
            )
            .returning();
          const updatedJob = updatedJobResult[0];

          // Fetch repo if repoId exists
          let repoMap:
            | Map<string, { id: string; url: string; name: string }>
            | undefined;
          let repoInfo = '';
          if (updatedJob.repoId) {
            const repo = await db
              .select()
              .from(repos)
              .where(
                and(
                  eq(repos.id, updatedJob.repoId),
                  eq(repos.orgId, user.orgId)
                )
              )
              .limit(1);
            if (repo.length > 0) {
              repoMap = new Map([
                [
                  repo[0].id,
                  { id: repo[0].id, url: repo[0].url, name: repo[0].name },
                ],
              ]);
              repoInfo = ` in repository ${repo[0].name}`;
            }
          }

          // Create activity for job update - always create activity for any update (audit log)
          const jobName = updatedJob.generatedName || 'Untitled Job';
          const changes: string[] = [];
          if (
            generated_name !== undefined &&
            generated_name !== currentJob.generatedName
          )
            changes.push('name');
          if (
            generated_description !== undefined &&
            generated_description !== currentJob.generatedDescription
          )
            changes.push('description');
          if (status !== undefined && status !== currentJob.status) {
            changes.push(
              `status changed from ${currentJob.status} to ${status}`
            );
            if (status === 'in-progress') changes.push('moved to in-progress');
            if (status === 'in-review') changes.push('moved to in-review');
            if (status === 'completed') changes.push('marked as completed');
          }
          if (priority !== undefined && priority !== currentJob.priority)
            changes.push(
              `priority changed from ${currentJob.priority} to ${priority}`
            );
          if (
            order_in_queue !== undefined &&
            order_in_queue !== currentJob.orderInQueue
          )
            changes.push(
              `order changed from ${currentJob.orderInQueue} to ${order_in_queue}`
            );
          if (
            user_acceptance_status !== undefined &&
            user_acceptance_status !== currentJob.userAcceptanceStatus
          ) {
            changes.push(
              `acceptance status changed from ${currentJob.userAcceptanceStatus} to ${user_acceptance_status}`
            );
          }
          if (
            user_comments !== undefined &&
            JSON.stringify(user_comments) !==
              JSON.stringify(currentJob.userComments)
          ) {
            changes.push('user comments');
          }
          if (repo !== undefined && repo !== currentJob.repoId) {
            const oldRepoName = currentJob.repoId || 'none';
            const newRepoName = repo || 'none';
            changes.push(
              `repository changed from ${oldRepoName} to ${newRepoName}`
            );
          }

          const changesText =
            changes.length > 0
              ? ` Changes: ${changes.join(', ')}.`
              : ' No specific changes detected.';
          const activitySummary = `Job "${jobName}" was updated${repoInfo} by ${
            updated_by || user.id
          }.${changesText}`;
          await createActivity(
            updatedJob.id,
            'Job Updated',
            activitySummary,
            updated_by || user.id,
            user.orgId
          );

          return reply.send(transformJobResponse(updatedJob, repoMap));
        }
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to update job' });
      }
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/jobs/:id',
    {
      schema: {
        tags: ['jobs'],
        description: 'Delete (archive) a job',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Job archived successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'JobResponse#',
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
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { id } = request.params;

        const currentJobResult = await db
          .select()
          .from(jobs)
          .where(and(eq(jobs.id, id), eq(jobs.orgId, user.orgId)))
          .orderBy(desc(jobs.version))
          .limit(1);
        const currentJob = currentJobResult[0] as Job | undefined;

        if (!currentJob) {
          return reply.code(404).send({ error: 'Job not found' });
        }

        if (currentJob.status === 'archived') {
          return reply.code(400).send({ error: 'Job is already archived' });
        }

        const updatedJobResult = await db
          .update(jobs)
          .set({
            status: 'archived',
            updatedAt: new Date(),
            updatedBy: user.id,
          })
          .where(
            and(
              eq(jobs.id, id),
              eq(jobs.version, currentJob.version),
              eq(jobs.orgId, user.orgId)
            )
          )
          .returning();
        const deletedJob = updatedJobResult[0];

        // Fetch repo if repoId exists
        let repoMap:
          | Map<string, { id: string; url: string; name: string }>
          | undefined;
        if (deletedJob.repoId) {
          const repo = await db
            .select()
            .from(repos)
            .where(
              and(eq(repos.id, deletedJob.repoId), eq(repos.orgId, user.orgId))
            )
            .limit(1);
          if (repo.length > 0) {
            repoMap = new Map([
              [
                repo[0].id,
                { id: repo[0].id, url: repo[0].url, name: repo[0].name },
              ],
            ]);
          }
        }

        // Create activity for job deletion
        const jobName = currentJob.generatedName || 'Untitled Job';
        const activitySummary = `Job "${jobName}" was archived (deleted) by ${user.id}.`;
        await createActivity(
          deletedJob.id,
          'Job Deleted',
          activitySummary,
          user.id,
          user.orgId
        );

        return reply.send(transformJobResponse(deletedJob, repoMap));
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to delete job' });
      }
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/jobs/:id/execute',
    {
      schema: {
        tags: ['jobs'],
        description: 'Execute a job',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          202: {
            description: 'Job execution started',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                    },
                    jobId: {
                      type: 'string',
                    },
                  },
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
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { id } = request.params;

        const jobResult = await db
          .select()
          .from(jobs)
          .where(and(eq(jobs.id, id), eq(jobs.orgId, user.orgId)))
          .orderBy(desc(jobs.version))
          .limit(1);

        if (!jobResult[0]) {
          return reply.code(404).send({ error: 'Job not found' });
        }

        const job = jobResult[0];

        // Validate job is in a queue
        if (job.status !== 'queued' || !job.queueType) {
          return reply.code(400).send({
            error: 'Job must be in a queue (rework or backlog) to execute',
          });
        }

        if (jobExecutionService.isExecuting(id)) {
          return reply.code(400).send({ error: 'Job is already executing' });
        }

        // Remove from queue before executing
        await removeJobFromQueue(id, user.orgId, job.version, user.id);

        // Reprioritize the queue
        await reprioritizeQueueAfterRemoval(
          user.orgId,
          job.queueType,
          job.orderInQueue
        );

        // Schedule job via Temporal
        const { workflowId } = await jobExecutionService.scheduleJob(
          id,
          user.orgId
        );

        // Create activity for job execution start
        const jobName = job.generatedName || 'Untitled Job';
        const activitySummary = `Job "${jobName}" execution was started. Job moved to in-progress state and removed from ${job.queueType} queue.`;
        await createActivity(
          job.id,
          'Job Execution Started',
          activitySummary,
          user.id,
          user.orgId
        );

        return reply.code(202).send({
          message: 'Job execution started',
          jobId: id,
          workflowId,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to start job execution' });
      }
    }
  );

  fastify.post<{ Params: { id: string }; Body: ReprioritizeJobRequest }>(
    '/jobs/:id/reprioritize',
    {
      schema: {
        tags: ['jobs'],
        description: 'Reprioritize a job by changing its queue position',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          $ref: 'ReprioritizeJobRequest#',
        },
        response: {
          200: {
            description: 'Job reprioritized successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ReprioritizeJobResponse#',
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
      request: FastifyRequest<{
        Params: { id: string };
        Body: ReprioritizeJobRequest;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { id } = request.params;
        const { position: newPosition } = request.body;

        if (newPosition < 0) {
          return reply
            .code(400)
            .send({ error: 'Position must be non-negative' });
        }

        const jobResult = await db
          .select()
          .from(jobs)
          .where(and(eq(jobs.id, id), eq(jobs.orgId, user.orgId)))
          .orderBy(desc(jobs.version))
          .limit(1);

        if (!jobResult[0]) {
          return reply.code(404).send({ error: 'Job not found' });
        }

        const job = jobResult[0];

        if (job.status !== 'queued') {
          return reply
            .code(400)
            .send({ error: 'Only queued jobs can be reprioritized' });
        }

        const oldPosition = job.orderInQueue;

        if (newPosition === oldPosition) {
          // Fetch repo if repoId exists
          let repoMap:
            | Map<string, { id: string; url: string; name: string }>
            | undefined;
          if (job.repoId) {
            const repo = await db
              .select()
              .from(repos)
              .where(and(eq(repos.id, job.repoId), eq(repos.orgId, user.orgId)))
              .limit(1);
            if (repo.length > 0) {
              repoMap = new Map([
                [
                  repo[0].id,
                  { id: repo[0].id, url: repo[0].url, name: repo[0].name },
                ],
              ]);
            }
          }

          return reply.send({
            message: 'Job is already at the requested position',
            job: transformJobResponse(job, repoMap),
          });
        }

        // Get all queued jobs in the same queue type, ordered by current position
        const queueTypeCondition = job.queueType
          ? eq(jobs.queueType, job.queueType)
          : sql`${jobs.queueType} IS NULL`;

        const allQueueJobs = await db
          .select()
          .from(jobs)
          .where(
            and(
              eq(jobs.orgId, user.orgId),
              eq(jobs.status, 'queued'),
              queueTypeCondition
            )
          )
          .orderBy(asc(jobs.orderInQueue));

        // Filter out the job being moved and create new order
        const otherJobs = allQueueJobs.filter(
          j => j.id !== id || j.version !== job.version
        );

        // Insert the moved job at the new position and reorder all jobs
        const reorderedJobs = [...otherJobs];
        reorderedJobs.splice(newPosition, 0, job);

        // Update all jobs to have strictly increasing order (0, 1, 2, 3, ...)
        const updatePromises = reorderedJobs.map((j, index) => {
          if (j.id === id && j.version === job.version) {
            // Update the moved job
            return db
              .update(jobs)
              .set({
                orderInQueue: index,
                updatedAt: new Date(),
                updatedBy: user.id,
              })
              .where(
                and(
                  eq(jobs.id, j.id),
                  eq(jobs.version, j.version),
                  eq(jobs.orgId, user.orgId)
                )
              );
          } else if (j.orderInQueue !== index) {
            // Update other jobs that need reordering
            return db
              .update(jobs)
              .set({
                orderInQueue: index,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(jobs.id, j.id),
                  eq(jobs.version, j.version),
                  eq(jobs.orgId, user.orgId)
                )
              );
          }
          return Promise.resolve();
        });

        await Promise.all(updatePromises);

        // Fetch the updated job
        const updatedJobResult = await db
          .select()
          .from(jobs)
          .where(
            and(
              eq(jobs.id, id),
              eq(jobs.version, job.version),
              eq(jobs.orgId, user.orgId)
            )
          )
          .limit(1);

        // Fetch repo if repoId exists
        let repoMap:
          | Map<string, { id: string; url: string; name: string }>
          | undefined;
        const updatedJob = updatedJobResult[0];
        if (updatedJob.repoId) {
          const repo = await db
            .select()
            .from(repos)
            .where(
              and(eq(repos.id, updatedJob.repoId), eq(repos.orgId, user.orgId))
            )
            .limit(1);
          if (repo.length > 0) {
            repoMap = new Map([
              [
                repo[0].id,
                { id: repo[0].id, url: repo[0].url, name: repo[0].name },
              ],
            ]);
          }
        }

        // Create activity for order change
        const jobName = updatedJob.generatedName || 'Untitled Job';
        const activitySummary = `Job "${jobName}" order was changed from position ${oldPosition} to position ${newPosition} in ${
          job.queueType || 'queue'
        } queue by ${
          user.id
        }. All jobs in the queue were reordered to maintain strict ordering.`;
        await createActivity(
          updatedJob.id,
          'Job Order Changed',
          activitySummary,
          user.id,
          user.orgId
        );

        return reply.send({
          message: `Job reprioritized from position ${oldPosition} to ${newPosition}`,
          job: transformJobResponse(updatedJob, repoMap),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to reprioritize job' });
      }
    }
  );

  // Queue workflow management endpoints
  // Note: These endpoints only manage the database pause state, not Temporal schedules
  // Temporal schedules are managed automatically based on agent status
  fastify.post<{ Params: { queueType: 'rework' | 'backlog' } }>(
    '/queues/:queueType/start',
    {
      schema: {
        description:
          'Resume queue processing for an organization (database state only)',
        tags: ['queues'],
        params: {
          type: 'object',
          properties: {
            queueType: { type: 'string', enum: ['rework', 'backlog'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
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
      request: FastifyRequest<{ Params: { queueType: 'rework' | 'backlog' } }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const queueType = request.params.queueType;

        // Only update database pause state, not Temporal schedules
        // Schedules are managed by agent status
        await queueWorkflowService.resumeQueue(user.orgId, queueType);

        return reply.send({
          message: `Queue ${queueType} resumed (database state updated)`,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to resume queue' });
      }
    }
  );

  fastify.post<{ Params: { queueType: 'rework' | 'backlog' } }>(
    '/queues/:queueType/pause',
    {
      schema: {
        description: 'Pause queue workflow',
        tags: ['queues'],
        params: {
          type: 'object',
          properties: {
            queueType: { type: 'string', enum: ['rework', 'backlog'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
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
      request: FastifyRequest<{ Params: { queueType: 'rework' | 'backlog' } }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const queueType = request.params.queueType;

        await queueWorkflowService.pauseQueue(user.orgId, queueType);

        return reply.send({ message: `Queue ${queueType} paused` });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to pause queue' });
      }
    }
  );

  fastify.post<{ Params: { queueType: 'rework' | 'backlog' } }>(
    '/queues/:queueType/resume',
    {
      schema: {
        description: 'Resume queue workflow',
        tags: ['queues'],
        params: {
          type: 'object',
          properties: {
            queueType: { type: 'string', enum: ['rework', 'backlog'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
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
      request: FastifyRequest<{ Params: { queueType: 'rework' | 'backlog' } }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const queueType = request.params.queueType;

        await queueWorkflowService.resumeQueue(user.orgId, queueType);

        return reply.send({ message: `Queue ${queueType} resumed` });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to resume queue' });
      }
    }
  );

  fastify.get<{ Params: { queueType: 'rework' | 'backlog' } }>(
    '/queues/:queueType/status',
    {
      schema: {
        description: 'Get queue pause state (database only)',
        tags: ['queues'],
        params: {
          type: 'object',
          properties: {
            queueType: { type: 'string', enum: ['rework', 'backlog'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              isPaused: { type: 'boolean' },
              message: { type: 'string' },
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
      request: FastifyRequest<{ Params: { queueType: 'rework' | 'backlog' } }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const queueType = request.params.queueType;

        // Only get database pause state
        const { isQueuePaused } = await import(
          '../temporal/activities/queue-status-activity'
        );
        const isPaused = await isQueuePaused({ orgId: user.orgId, queueType });

        return reply.send({
          isPaused,
          message: `Queue ${queueType} is ${
            isPaused ? 'paused' : 'active'
          } (database state)`,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to get queue status' });
      }
    }
  );
}

export default jobsRoutes;

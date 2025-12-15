import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { WebSocket } from 'ws';
import { db, schema } from '../db/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { websocketManager } from '../services/websocket-manager.js';
import { getCurrentUser, type User } from '../auth/index.js';
import * as crypto from 'crypto';

// Helper function to authenticate user for WebSocket (doesn't send HTTP responses)
async function authenticateUserForWebSocket(
  authHeader: string
): Promise<User | null> {
  try {
    if (!authHeader) {
      return null;
    }

    const apiKey = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7).trim()
      : authHeader.trim();

    // Handle API key authentication
    if (apiKey.startsWith('sia_sk_')) {
      const { apiKeys } = schema;
      const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

      const [storedKey] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, keyHash))
        .limit(1);

      if (!storedKey) {
        return null;
      }

      await db
        .update(apiKeys)
        .set({
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(apiKeys.id, storedKey.id));

      return {
        id: storedKey.userId,
        email: `api-key-${storedKey.id}@api.sia`,
        orgId: storedKey.orgId,
        role: 'admin',
        name: storedKey.name,
      };
    }

    // Handle PropelAuth token
    interface AuthInstance {
      validateAccessTokenAndGetUser: (authorizationHeader: string) => Promise<{
        userId: string;
        email: string;
        activeOrgId?: string | null;
        orgIdToOrgMemberInfo?: Record<
          string,
          {
            assignedRole?: string;
          }
        >;
        firstName?: string | null;
        lastName?: string | null;
      }>;
    }

    let authInstance: AuthInstance | null = null;
    try {
      const { initBaseAuth } = await import('@propelauth/node');
      const authUrl = process.env.PROPEL_AUTH_URL;
      const apiKey = process.env.PROPEL_VERIFICATION_KEY;

      if (authUrl && apiKey) {
        const auth = initBaseAuth({
          authUrl,
          apiKey,
        });
        authInstance = {
          validateAccessTokenAndGetUser: auth.validateAccessTokenAndGetUser,
        };
      }
    } catch {
      // PropelAuth not configured - use mock for development
    }

    if (!authInstance) {
      // Mock authentication for development
      return {
        id: 'dev_user',
        email: 'dev@example.com',
        orgId: 'dev_org',
        role: 'admin',
        name: 'Dev User',
      };
    }

    const user = await authInstance.validateAccessTokenAndGetUser(authHeader);

    let orgId: string;
    let role: 'admin' | 'viewer';

    if (user.activeOrgId) {
      orgId = user.activeOrgId;
      const orgMemberInfo = user.orgIdToOrgMemberInfo?.[user.activeOrgId];

      if (!orgMemberInfo) {
        return null;
      }

      const userRole = orgMemberInfo.assignedRole?.toLowerCase() || 'viewer';
      role = userRole === 'admin' || userRole === 'owner' ? 'admin' : 'viewer';
    } else {
      orgId = user.userId;
      role = 'admin';
    }

    let name: string | undefined;
    if (user.firstName && user.lastName) {
      name = `${user.firstName} ${user.lastName}`;
    } else if (user.firstName) {
      name = user.firstName;
    } else if (user.lastName) {
      name = user.lastName;
    }

    return {
      id: user.userId,
      email: user.email,
      orgId,
      role,
      name,
    };
  } catch (error) {
    console.error('WebSocket authentication error:', error);
    return null;
  }
}

const { jobs } = schema;

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

interface LogsQuery {
  version?: string;
  stage?: string;
  level?: string;
  limit?: string;
  offset?: string;
}

async function jobLogsRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string }; Querystring: LogsQuery }>(
    '/jobs/:id/logs',
    {
      schema: {
        tags: ['job-logs'],
        description: 'Get job logs',
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
            stage: { type: 'string' },
            level: { type: 'string' },
            limit: { type: 'string' },
            offset: { type: 'string' },
          },
        },
        response: {
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
        Querystring: LogsQuery;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user;
        if (!user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        const { id } = request.params;
        const { version, limit = '1000', offset = '0' } = request.query;

        let jobVersion: number;
        if (version) {
          jobVersion = parseInt(version);
        } else {
          const jobResult = await db
            .select()
            .from(jobs)
            .where(and(eq(jobs.id, id), eq(jobs.orgId, user.orgId)))
            .orderBy(desc(jobs.version))
            .limit(1);

          if (!jobResult[0]) {
            return reply.code(404).send({ error: 'Job not found' });
          }

          jobVersion = jobResult[0].version;
        }

        // Get job with logs
        const jobResult = await db
          .select({
            codeGenerationLogs: jobs.codeGenerationLogs,
            codeVerificationLogs: jobs.codeVerificationLogs,
          })
          .from(jobs)
          .where(
            and(
              eq(jobs.id, id),
              eq(jobs.version, jobVersion),
              eq(jobs.orgId, user.orgId)
            )
          )
          .limit(1);

        if (!jobResult[0]) {
          return reply.code(404).send({ error: 'Job not found' });
        }

        // Combine logs from both code generation and verification
        const allLogs: Array<{
          level: string;
          timestamp: string;
          message: string;
          stage?: string;
        }> = [];

        // Add code generation logs
        if (Array.isArray(jobResult[0].codeGenerationLogs)) {
          jobResult[0].codeGenerationLogs.forEach(log => {
            allLogs.push({
              level: log.level,
              timestamp: log.timestamp,
              message: log.message,
              stage: 'code-generation',
            });
          });
        }

        // Add verification logs
        if (Array.isArray(jobResult[0].codeVerificationLogs)) {
          jobResult[0].codeVerificationLogs.forEach(log => {
            allLogs.push({
              level: log.level,
              timestamp: log.timestamp,
              message: log.message,
              stage: 'verification',
            });
          });
        }

        // Sort by timestamp
        allLogs.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // Apply pagination
        const limitNum = parseInt(limit);
        const offsetNum = parseInt(offset);
        const paginatedLogs = allLogs.slice(offsetNum, offsetNum + limitNum);

        return reply.send(paginatedLogs);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to fetch logs' });
      }
    }
  );

  fastify.get<{
    Params: { id: string };
    Querystring: { token?: string; version?: string };
  }>(
    '/jobs/:id/logs/stream',
    {
      websocket: true,
    },
    async (connection, req) => {
      // Fastify WebSocket connection is a SocketStream with socket property
      const reqTyped = req as FastifyRequest<{
        Params: { id: string };
        Querystring: { token?: string; version?: string };
      }>;
      const jobId = reqTyped.params.id;
      const versionFromQuery = reqTyped.query?.version
        ? parseInt(reqTyped.query.version, 10)
        : undefined;

      // Extract socket from connection
      // In @fastify/websocket, connection can be either:
      // 1. { socket: WebSocket } - SocketStream object
      // 2. WebSocket - the socket itself (in some cases)
      let socket: WebSocket | undefined;

      // Try to access as SocketStream first
      const connWithSocket = connection as unknown as { socket?: WebSocket };
      if (
        connWithSocket.socket &&
        typeof connWithSocket.socket.on === 'function'
      ) {
        socket = connWithSocket.socket;
      }
      // Fallback: connection might be the socket itself
      else if (
        connection &&
        typeof (connection as unknown as WebSocket).on === 'function'
      ) {
        socket = connection as unknown as WebSocket;
      }

      if (!socket || typeof socket.on !== 'function') {
        const errorMsg = `[WebSocket] Invalid WebSocket connection object for job ${jobId} - socket is ${
          socket ? 'missing on method' : 'undefined'
        }`;
        fastify.log.error(errorMsg);
        if (socket) {
          const details = `readyState: ${
            socket.readyState
          }, hasOn: ${typeof socket.on}, hasSend: ${typeof socket.send}`;
          fastify.log.error(`[WebSocket] Socket object details: ${details}`);
        } else {
          fastify.log.error(
            `[WebSocket] Connection type: ${typeof connection}, has socket property: ${!!connWithSocket.socket}`
          );
        }
        return;
      }

      // Log connection immediately - connection is already open when handler runs
      fastify.log.info(
        `[WebSocket] Connection established for job ${jobId}, readyState: ${socket.readyState}`
      );

      // Helper function to safely send messages
      const safeSend = (data: unknown): boolean => {
        if (socket.readyState !== 1) {
          // WebSocket.OPEN
          fastify.log.warn(
            `[WebSocket] Cannot send message for job ${jobId}, socket not open (readyState: ${socket.readyState})`
          );
          return false;
        }
        try {
          const messageStr = JSON.stringify(data);
          socket.send(messageStr);
          return true;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          fastify.log.error(
            `[WebSocket] Failed to send message for job ${jobId}: ${errorMessage}`
          );
          return false;
        }
      };

      // CRITICAL: Attach message handler IMMEDIATELY before any async operations
      // Messages can arrive before authentication completes, so we need to queue them
      let isReady = false;
      let authenticatedUser: User | null = null;
      const messageQueue: Buffer[] = [];

      // Message processing function - can be called from event handler or for queued messages
      const processMessage = (message: Buffer) => {
        if (!isReady) {
          // Queue messages until authentication and setup are complete
          fastify.log.info(
            `[WebSocket] Queueing message for job ${jobId} (not ready yet), queue size: ${
              messageQueue.length + 1
            }`
          );
          messageQueue.push(message);
          return;
        }

        // Process message now that we're ready
        try {
          const messageStr = message.toString();
          fastify.log.info(
            `[WebSocket] Received message for job ${jobId}: ${messageStr.substring(
              0,
              100
            )}, socket readyState: ${socket.readyState}`
          );
          const data = JSON.parse(messageStr);
          fastify.log.info(
            `[WebSocket] Parsed message type: ${data.type} for job ${jobId}`
          );

          if (data.type === 'subscribe') {
            fastify.log.info(
              `[WebSocket] Processing subscribe for job ${jobId}`
            );
            // Wrap async operations in IIFE
            (async () => {
              try {
                fastify.log.info(
                  `[WebSocket] Starting subscribe handler for job ${jobId}, socket readyState: ${socket.readyState}`
                );
                // Validate jobId matches if provided in message
                const messageJobId = data.jobId;
                const messageVersion = data.version;

                if (messageJobId && messageJobId !== jobId) {
                  fastify.log.warn(
                    `[WebSocket] JobId mismatch: URL has ${jobId}, message has ${messageJobId}`
                  );
                  safeSend({
                    type: 'error',
                    message: `JobId mismatch: expected ${jobId}, got ${messageJobId}`,
                  });
                  return;
                }

                if (!authenticatedUser) {
                  fastify.log.error(
                    `[WebSocket] Cannot process subscribe - user not authenticated for job ${jobId}`
                  );
                  safeSend({
                    type: 'error',
                    message: 'Authentication required',
                  });
                  return;
                }

                // Get current job to validate version
                const jobResult = await db
                  .select({ version: jobs.version })
                  .from(jobs)
                  .where(
                    and(
                      eq(jobs.id, jobId),
                      eq(jobs.orgId, authenticatedUser.orgId)
                    )
                  )
                  .orderBy(desc(jobs.version))
                  .limit(1);

                if (jobResult.length === 0) {
                  fastify.log.warn(`[WebSocket] Job ${jobId} not found`);
                  safeSend({
                    type: 'error',
                    message: 'Job not found',
                  });
                  return;
                }

                const currentVersion = jobResult[0].version;

                // Determine which version to use: message > query param > current
                const requestedVersion =
                  messageVersion !== undefined && messageVersion !== null
                    ? messageVersion
                    : versionFromQuery !== undefined
                    ? versionFromQuery
                    : currentVersion;

                // Validate version if explicitly provided (either in message or query)
                if (
                  (messageVersion !== undefined && messageVersion !== null) ||
                  versionFromQuery !== undefined
                ) {
                  if (requestedVersion !== currentVersion) {
                    fastify.log.warn(
                      `[WebSocket] Version mismatch: current is ${currentVersion}, requested is ${requestedVersion}`
                    );
                    safeSend({
                      type: 'error',
                      message: `Version mismatch: current version is ${currentVersion}, requested ${requestedVersion}`,
                    });
                    return;
                  }
                }

                const jobVersion = requestedVersion;

                fastify.log.info(
                  `[WebSocket] Subscribing to logs for job ${jobId}, version ${jobVersion}, socket readyState: ${socket.readyState}`
                );
                websocketManager.subscribe(jobId, socket);

                // Send subscribed confirmation immediately
                const subscribedSent = safeSend({
                  type: 'subscribed',
                  jobId,
                  version: jobVersion,
                });
                if (subscribedSent) {
                  fastify.log.info(
                    `[WebSocket] Sent subscribed confirmation for job ${jobId}, version ${jobVersion}`
                  );
                } else {
                  fastify.log.error(
                    `[WebSocket] Failed to send subscribed confirmation for job ${jobId}, version ${jobVersion}`
                  );
                }

                // Get job with logs for the specific version
                db.select({
                  codeGenerationLogs: jobs.codeGenerationLogs,
                  codeVerificationLogs: jobs.codeVerificationLogs,
                })
                  .from(jobs)
                  .where(
                    and(
                      eq(jobs.id, jobId),
                      eq(jobs.version, jobVersion),
                      eq(jobs.orgId, authenticatedUser.orgId)
                    )
                  )
                  .limit(1)
                  .then(jobResults => {
                    if (jobResults.length === 0) {
                      fastify.log.warn(
                        `[WebSocket] Job ${jobId} not found for historical logs`
                      );
                      safeSend({
                        type: 'historical-logs',
                        data: [],
                      });
                      return;
                    }

                    const job = jobResults[0];

                    // Combine logs from both code generation and verification
                    const allLogs: Array<{
                      level: string;
                      timestamp: string;
                      message: string;
                      jobId: string;
                      stage?: string;
                    }> = [];

                    // Add code generation logs
                    if (Array.isArray(job.codeGenerationLogs)) {
                      job.codeGenerationLogs.forEach(log => {
                        allLogs.push({
                          level: log.level,
                          timestamp: log.timestamp,
                          message: log.message,
                          jobId,
                          stage: 'code-generation',
                        });
                      });
                    }

                    // Add verification logs
                    if (Array.isArray(job.codeVerificationLogs)) {
                      job.codeVerificationLogs.forEach(log => {
                        allLogs.push({
                          level: log.level,
                          timestamp: log.timestamp,
                          message: log.message,
                          jobId,
                          stage: 'verification',
                        });
                      });
                    }

                    // Sort by timestamp (oldest first, then reverse to get newest first)
                    allLogs.sort(
                      (a, b) =>
                        new Date(a.timestamp).getTime() -
                        new Date(b.timestamp).getTime()
                    );

                    // Send ALL logs (not just 50) - reverse to show newest first
                    const recentLogs = allLogs.reverse();

                    fastify.log.info(
                      `[WebSocket] Sending ${recentLogs.length} historical logs for job ${jobId}`
                    );
                    const historicalSent = safeSend({
                      type: 'historical-logs',
                      data: recentLogs,
                    });
                    if (!historicalSent) {
                      fastify.log.error(
                        `[WebSocket] Failed to send historical logs for job ${jobId}`
                      );
                    }
                  })
                  .catch(err => {
                    fastify.log.error(
                      `[WebSocket] Error fetching historical logs for job ${jobId}:`,
                      err
                    );
                    // Send empty array on error so client doesn't hang
                    safeSend({
                      type: 'historical-logs',
                      data: [],
                    });
                  });
              } catch (error) {
                const errorMessage =
                  error instanceof Error ? error.message : String(error);
                const errorStack =
                  error instanceof Error ? error.stack : undefined;
                fastify.log.error(
                  `[WebSocket] Error in subscribe handler for job ${jobId}: ${errorMessage}. Stack: ${
                    errorStack || 'none'
                  }`
                );
                const errorSent = safeSend({
                  type: 'error',
                  message: 'Failed to process subscription',
                });
                if (!errorSent) {
                  fastify.log.error(
                    `[WebSocket] Also failed to send error message for job ${jobId}, socket readyState: ${socket.readyState}`
                  );
                }
              }
            })().catch(error => {
              // Catch any unhandled promise rejections
              fastify.log.error(
                `[WebSocket] Unhandled error in subscribe IIFE for job ${jobId}:`,
                error
              );
            });
          } else if (data.type === 'unsubscribe') {
            const messageJobId = data.jobId;
            const messageVersion = data.version;

            // Validate jobId if provided
            if (messageJobId && messageJobId !== jobId) {
              fastify.log.warn(
                `[WebSocket] Unsubscribe JobId mismatch: URL has ${jobId}, message has ${messageJobId}`
              );
            }

            fastify.log.info(
              `[WebSocket] Unsubscribing from logs for job ${jobId}${
                messageVersion ? `, version ${messageVersion}` : ''
              }`
            );
            websocketManager.unsubscribe(jobId, socket);
            const unsubscribedSent = safeSend({
              type: 'unsubscribed',
              jobId,
              version: messageVersion,
            });
            if (!unsubscribedSent) {
              fastify.log.warn(
                `[WebSocket] Failed to send unsubscribed confirmation for job ${jobId}`
              );
            }
          } else {
            fastify.log.warn(
              `[WebSocket] Unknown message type from job ${jobId}:`,
              data.type
            );
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          fastify.log.error(
            `[WebSocket] Error processing message for job ${jobId}: ${errorMessage}`
          );
          safeSend({
            type: 'error',
            message: 'Invalid message format',
          });
        }
      };

      // Attach message handler
      fastify.log.info(
        `[WebSocket] Setting up message handler immediately for job ${jobId}, socket readyState: ${socket.readyState}`
      );
      socket.on('message', processMessage);

      // Now do authentication and setup
      // Authenticate user from query parameter (WebSocket can't send headers)
      const tokenFromQuery = reqTyped.query?.token;
      const authHeader = tokenFromQuery ? `Bearer ${tokenFromQuery}` : '';
      authenticatedUser = await authenticateUserForWebSocket(authHeader);

      if (!authenticatedUser) {
        fastify.log.warn(`[WebSocket] Authentication failed for job ${jobId}`);
        socket.close();
        return;
      }

      // Verify job belongs to user's org
      const jobResult = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, jobId), eq(jobs.orgId, authenticatedUser.orgId)))
        .limit(1);

      if (!jobResult[0]) {
        fastify.log.warn(
          `[WebSocket] Job ${jobId} not found for user org ${authenticatedUser.orgId}`
        );
        safeSend({
          type: 'error',
          message: 'Job not found',
        });
        socket.close();
        return;
      }

      // Mark as ready and process queued messages
      isReady = true;
      const queuedCount = messageQueue.length;
      fastify.log.info(
        `[WebSocket] Ready for job ${jobId}, processing ${queuedCount} queued messages`
      );

      // Process all queued messages
      const queuedMessages = [...messageQueue]; // Copy array
      messageQueue.length = 0; // Clear the queue
      for (const queuedMessage of queuedMessages) {
        fastify.log.info(
          `[WebSocket] Processing queued message for job ${jobId}`
        );
        processMessage(queuedMessage);
      }

      // Note: 'open' event won't fire because connection is already open when handler runs
      // Connection is established before this handler is called

      socket.on('close', (code: number, reason: Buffer) => {
        fastify.log.info(
          `[WebSocket] Connection closed for job ${jobId}, code: ${code}, reason: ${
            reason?.toString() || 'none'
          }`
        );
        websocketManager.unsubscribe(jobId, socket);
      });

      socket.on('error', (error: Error) => {
        fastify.log.error(
          `[WebSocket] Error for job ${jobId}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      });
    }
  );
}

export default jobLogsRoutes;

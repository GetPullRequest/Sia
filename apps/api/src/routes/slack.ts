import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  db,
  schema,
  type Integration,
  type NewIntegration,
} from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { getCurrentUser, type User } from '../auth/index.js';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const { integrations } = schema;

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

interface SlackOAuthCallback {
  code?: string;
  state?: string;
  error?: string;
}

interface SlackOAuthResponse {
  ok: boolean;
  access_token?: string;
  token_type?: string;
  scope?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: {
    id: string;
    name: string;
  };
  authed_user?: {
    id: string;
    scope?: string;
    access_token?: string;
    token_type?: string;
  };
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

interface SlackTokenRefreshResponse {
  ok: boolean;
  access_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
}

interface SlackTeamInfo {
  ok: boolean;
  team?: {
    id: string;
    name: string;
    domain: string;
  };
  error?: string;
}

function transformIntegrationResponse(integration: Integration) {
  return {
    id: integration.id,
    org_id: integration.orgId,
    provider_type: integration.providerType,
    name: integration.name,
    provider_team_id: integration.providerTeamId,
    provider_user_id: integration.providerUserId,
    access_token: integration.accessToken,
    refresh_token: integration.refreshToken,
    expires_in: integration.expiresIn,
    token_created_at: integration.tokenCreatedAt
      ? integration.tokenCreatedAt.toISOString()
      : undefined,
    management_url: integration.managementUrl,
    metadata: integration.metadata || {},
    created_at: integration.createdAt.toISOString(),
    updated_at: integration.updatedAt.toISOString(),
  };
}

async function getValidAccessToken(integration: Integration): Promise<string> {
  if (!integration.accessToken) {
    throw new Error('No access token available');
  }

  if (!integration.refreshToken || !integration.expiresIn) {
    return integration.accessToken;
  }

  const tokenCreatedAt = integration.tokenCreatedAt
    ? new Date(integration.tokenCreatedAt)
    : new Date(integration.createdAt);
  const expiresAt = new Date(
    tokenCreatedAt.getTime() + integration.expiresIn * 1000
  );
  const now = new Date();
  const bufferSeconds = 300;
  const needsRefresh =
    expiresAt.getTime() - now.getTime() < bufferSeconds * 1000;

  if (needsRefresh) {
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Slack OAuth credentials not configured');
    }

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: integration.refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.statusText}`);
    }

    const tokenData = (await response.json()) as SlackTokenRefreshResponse;

    if (!tokenData.ok || !tokenData.access_token) {
      throw new Error(
        `Token refresh failed: ${tokenData.error || 'Unknown error'}`
      );
    }

    const expiresIn = tokenData.expires_in || 0;

    await db
      .update(integrations)
      .set({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || integration.refreshToken,
        expiresIn: expiresIn,
        tokenCreatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integration.id));

    return tokenData.access_token;
  }

  return integration.accessToken;
}

async function slackRoutes(fastify: FastifyInstance) {
  fastify.log.info('Initializing Slack routes...');

  fastify.get<{ Querystring: { state?: string } }>(
    '/integrations/slack/connect',
    {
      schema: {
        tags: ['integrations'],
        description: 'Initiate Slack OAuth connection',
        querystring: {
          type: 'object',
          properties: {
            state: { type: 'string' },
            redirect_uri: { type: 'string' },
          },
        },
        response: {
          200: {
            description:
              'Redirect URL in JSON format (when Accept: application/json)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    redirectUrl: {
                      type: 'string',
                      description: 'URL to redirect to for Slack OAuth',
                    },
                  },
                  required: ['redirectUrl'],
                },
              },
            },
          },
          302: {
            description: 'Redirect to Slack OAuth (when not requesting JSON)',
          },
          400: {
            description: 'Bad Request',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
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
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
          500: {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
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
        Querystring: { state?: string; redirect_uri?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const clientId = process.env.SLACK_CLIENT_ID;
        const clientSecret = process.env.SLACK_CLIENT_SECRET;
        // Use redirect_uri from query parameter if provided, otherwise fall back to env var or default
        const redirectUri =
          request.query.redirect_uri ||
          process.env.SLACK_REDIRECT_URI ||
          `${request.protocol}://${request.hostname}/integrations/slack/connect/callback`;

        if (!clientId || !clientSecret) {
          return reply
            .code(400)
            .send({ error: 'Slack OAuth credentials not configured' });
        }

        const state = request.query.state || uuidv4();
        const scopes =
          process.env.SLACK_SCOPES ||
          'app_mentions:read,chat:write,channels:history,channels:read,groups:history,groups:read,im:history,im:read,mpim:history,mpim:read,users:read';

        const oauthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${encodeURIComponent(
          scopes
        )}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

        reply.setCookie('oauth_state', state, {
          path: '/',
          httpOnly: true,
          maxAge: 600,
        });
        // Store redirect_uri in cookie so callback can use the same one
        reply.setCookie('oauth_redirect_uri', redirectUri, {
          path: '/',
          httpOnly: true,
          maxAge: 600,
        });

        const wantsJson = request.headers.accept?.includes('application/json');
        if (wantsJson) {
          return reply.code(200).send({ redirectUrl: oauthUrl });
        }

        return reply.redirect(oauthUrl);
      } catch (error) {
        fastify.log.error(
          { err: error },
          'Failed to initiate Slack connection'
        );
        return reply
          .code(500)
          .send({ error: 'Failed to initiate Slack connection' });
      }
    }
  );

  fastify.get<{ Querystring: SlackOAuthCallback }>(
    '/integrations/slack/connect/callback',
    {
      schema: {
        tags: ['integrations'],
        description: 'Handle Slack OAuth callback',
        querystring: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            state: { type: 'string' },
            error: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Integration successful',
            content: {
              'application/json': {
                schema: {
                  $ref: 'IntegrationResponse#',
                },
              },
            },
          },
          400: {
            description: 'Bad Request',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
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
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
          500: {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
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
      request: FastifyRequest<{ Querystring: SlackOAuthCallback }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user;
        if (!user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        const { code, state, error } = request.query;

        if (error) {
          return reply.code(400).send({ error: `OAuth error: ${error}` });
        }

        if (!code) {
          return reply
            .code(400)
            .send({ error: 'Authorization code is required' });
        }

        if (state) {
          const storedState = request.cookies.oauth_state;
          if (storedState && state !== storedState) {
            return reply.code(400).send({ error: 'Invalid state parameter' });
          }
        }

        const clientId = process.env.SLACK_CLIENT_ID;
        const clientSecret = process.env.SLACK_CLIENT_SECRET;
        // Use redirect_uri from cookie (set during OAuth initiation), otherwise fall back to env var or default
        const redirectUri =
          request.cookies.oauth_redirect_uri ||
          process.env.SLACK_REDIRECT_URI ||
          `${request.protocol}://${request.hostname}/integrations/slack/connect/callback`;

        if (!clientId || !clientSecret) {
          return reply
            .code(400)
            .send({ error: 'Slack OAuth credentials not configured' });
        }

        const tokenResponse = await fetch(
          'https://slack.com/api/oauth.v2.access',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              code: code,
              redirect_uri: redirectUri,
            }),
          }
        );

        if (!tokenResponse.ok) {
          const txt = await tokenResponse.text();
          fastify.log.error({ txt }, 'Failed to exchange code for token');
          return reply
            .code(400)
            .send({ error: 'Failed to exchange authorization code for token' });
        }

        const tokenData = (await tokenResponse.json()) as SlackOAuthResponse;

        if (!tokenData.ok || !tokenData.access_token) {
          return reply.code(400).send({
            error: `OAuth failed: ${tokenData.error || 'Unknown error'}`,
          });
        }

        const orgId = user.orgId;
        const integrationId = uuidv4();

        let teamName = tokenData.team?.name || 'Slack Workspace';
        if (tokenData.team?.id) {
          try {
            const teamInfoResponse = await fetch(
              `https://slack.com/api/team.info?team=${tokenData.team.id}`,
              {
                headers: {
                  Authorization: `Bearer ${tokenData.access_token}`,
                },
              }
            );
            if (teamInfoResponse.ok) {
              const teamInfo = (await teamInfoResponse.json()) as SlackTeamInfo;
              if (teamInfo.ok && teamInfo.team) {
                teamName = teamInfo.team.name;
              }
            }
          } catch (error) {
            fastify.log.warn(
              { err: error },
              'Failed to fetch team info, using default name'
            );
          }
        }

        const integrationName = `Slack - ${teamName}`;
        const managementUrl = tokenData.app_id
          ? `https://api.slack.com/apps/${tokenData.app_id}`
          : null;

        const newIntegration: NewIntegration = {
          id: integrationId,
          orgId: orgId,
          providerType: 'slack',
          name: integrationName,
          providerTeamId: tokenData.team?.id || null,
          providerUserId:
            tokenData.authed_user?.id || tokenData.bot_user_id || null,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || null,
          expiresIn: tokenData.expires_in || null,
          tokenCreatedAt: new Date(),
          managementUrl: managementUrl,
          metadata: {
            app_id: tokenData.app_id,
            bot_user_id: tokenData.bot_user_id,
            scope: tokenData.scope,
            authed_user: tokenData.authed_user,
          },
        };

        const createdIntegration = await db
          .insert(integrations)
          .values(newIntegration)
          .returning();

        reply.clearCookie('oauth_state');
        reply.clearCookie('oauth_redirect_uri');

        return reply.send(
          transformIntegrationResponse(createdIntegration[0] as Integration)
        );
      } catch (error) {
        fastify.log.error(
          { err: error },
          'Failed to complete Slack integration'
        );
        return reply
          .code(500)
          .send({ error: 'Failed to complete Slack integration' });
      }
    }
  );

  fastify.get(
    '/integrations/slack/providers',
    {
      schema: {
        tags: ['integrations'],
        description: 'Get all Slack integrations for the current organization',
        response: {
          200: {
            description: 'List of Slack integrations',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: 'IntegrationResponse#',
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
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
          500: {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
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
        const user = request.user;
        if (!user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const integrationList = await db
          .select()
          .from(integrations)
          .where(
            and(
              eq(integrations.orgId, user.orgId),
              eq(integrations.providerType, 'slack')
            )
          );

        return reply.send(integrationList.map(transformIntegrationResponse));
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to fetch Slack integrations');
        return reply
          .code(500)
          .send({ error: 'Failed to fetch Slack integrations' });
      }
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/integrations/slack/providers/:id',
    {
      schema: {
        tags: ['integrations'],
        description: 'Get a Slack integration by ID',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Integration retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'IntegrationResponse#',
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
          404: {
            description: 'Integration not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
          500: {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
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
        const user = request.user;
        if (!user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        const { id } = request.params;

        const integrationList = await db
          .select()
          .from(integrations)
          .where(
            and(
              eq(integrations.id, id),
              eq(integrations.orgId, user.orgId),
              eq(integrations.providerType, 'slack')
            )
          )
          .limit(1);

        if (!integrationList[0]) {
          return reply.code(404).send({ error: 'Integration not found' });
        }

        return reply.send(
          transformIntegrationResponse(integrationList[0] as Integration)
        );
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to fetch integration');
        return reply.code(500).send({ error: 'Failed to fetch integration' });
      }
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/integrations/slack/providers/:id',
    {
      schema: {
        tags: ['integrations'],
        description: 'Delete a Slack integration',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Integration deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
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
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
          404: {
            description: 'Integration not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
          500: {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
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
        const user = request.user;
        if (!user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        const { id } = request.params;

        const integrationList = await db
          .select()
          .from(integrations)
          .where(
            and(
              eq(integrations.id, id),
              eq(integrations.orgId, user.orgId),
              eq(integrations.providerType, 'slack')
            )
          )
          .limit(1);

        if (!integrationList[0]) {
          return reply.code(404).send({ error: 'Integration not found' });
        }

        await db
          .delete(integrations)
          .where(
            and(eq(integrations.id, id), eq(integrations.orgId, user.orgId))
          );

        return reply.send({ message: 'Integration deleted successfully' });
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to delete integration');
        return reply.code(500).send({ error: 'Failed to delete integration' });
      }
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/integrations/slack/providers/:id/token',
    {
      schema: {
        tags: ['integrations'],
        description: 'Get or refresh access token for a Slack integration',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Token retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    access_token: { type: 'string' },
                    refresh_token: { type: 'string' },
                    expires_in: { type: 'number' },
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
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
          404: {
            description: 'Integration not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
          500: {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
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
        const user = request.user;
        if (!user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        const { id } = request.params;

        const integrationList = await db
          .select()
          .from(integrations)
          .where(
            and(
              eq(integrations.id, id),
              eq(integrations.orgId, user.orgId),
              eq(integrations.providerType, 'slack')
            )
          )
          .limit(1);

        if (!integrationList[0]) {
          return reply.code(404).send({ error: 'Integration not found' });
        }

        const integration = integrationList[0] as Integration;

        let accessToken: string;
        try {
          accessToken = await getValidAccessToken(integration);
        } catch (error) {
          fastify.log.error({ err: error }, 'Token refresh failed');
          return reply.code(401).send({
            error:
              'Failed to get valid access token. Please reconnect your Slack workspace.',
          });
        }

        return reply.send({
          access_token: accessToken,
          refresh_token: integration.refreshToken || '',
          expires_in: integration.expiresIn || 0,
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to get token');
        return reply.code(500).send({ error: 'Failed to get token' });
      }
    }
  );

  fastify.post(
    '/integrations/slack/events',
    {
      schema: {
        tags: ['integrations'],
        description: 'Handle Slack events',
        response: {
          200: {
            description: 'Event processed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    challenge: { type: 'string' },
                  },
                },
              },
              'text/plain': {
                schema: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        request.log.info(
          { body: request.body, headers: request.headers },
          'Received Slack event'
        );
        const body = request.body as Record<string, unknown>;

        // Define Slack event types
        interface SlackLinkSharedEvent {
          type: 'link_shared';
          channel: string;
          message_ts: string;
          links: Array<{
            url: string;
            domain: string;
          }>;
        }

        interface SlackMessageEvent {
          type: 'message' | 'app_mention';
          subtype?: string;
          bot_id?: string;
          user?: string;
          text?: string;
          channel?: string;
          ts?: string;
          team?: string;
        }

        // Handle URL verification FIRST (before signature check)
        if (body.type === 'url_verification') {
          request.log.info(
            { challenge: body.challenge },
            'Handling URL verification'
          );
          return reply.send({ challenge: body.challenge });
        }

        // Now verify signature for all other requests
        const signature = request.headers['x-slack-signature'] as string;
        const timestamp = request.headers[
          'x-slack-request-timestamp'
        ] as string;
        // Use rawBody if available, otherwise fall back to stringified body
        const rawBody =
          (request as FastifyRequest & { rawBody?: string }).rawBody ||
          JSON.stringify(body);

        const signingSecret = process.env.SLACK_SIGNING_SECRET;
        if (!signingSecret) {
          request.log.warn('SLACK_SIGNING_SECRET not configured');
          return reply.code(500).send({ error: 'Server configuration error' });
        }

        if (!signature || !timestamp) {
          request.log.warn('Missing signature or timestamp in request');
          return reply
            .code(401)
            .send({ error: 'Missing signature or timestamp' });
        }

        const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
        if (parseInt(timestamp) < fiveMinutesAgo) {
          request.log.warn({ timestamp }, 'Request too old');
          return reply.code(401).send({ error: 'Request too old' });
        }

        const hmac = crypto.createHmac('sha256', signingSecret);
        const [version, hash] = signature.split('=');
        const base = `${version}:${timestamp}:${rawBody}`;
        hmac.update(base);
        const mySignature = hmac.digest('hex');

        if (
          !crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(mySignature))
        ) {
          request.log.warn({ signature, mySignature }, 'Invalid signature');
          return reply.code(401).send({ error: 'Invalid signature' });
        }

        // Handle Event Callback
        if (body.type === 'event_callback') {
          const eventData = body.event as Record<string, unknown>;
          request.log.info(
            { eventType: eventData?.type },
            'Handling event callback'
          );

          // Handle link_shared event for unfurling
          if (eventData.type === 'link_shared') {
            const event = eventData as unknown as SlackLinkSharedEvent;
            request.log.info(
              { links: event.links },
              'Handling link_shared event'
            );

            const teamId = (body.team_id ||
              (body as { team_id?: string }).team_id) as string | undefined;
            if (!teamId) {
              request.log.warn('No team_id found in link_shared event');
              return reply.code(200).send();
            }

            const integrationList = await db
              .select()
              .from(integrations)
              .where(
                and(
                  eq(integrations.providerTeamId, teamId),
                  eq(integrations.providerType, 'slack')
                )
              )
              .limit(1);

            if (!integrationList[0]) {
              request.log.warn(
                { teamId },
                'No integration found for Slack team'
              );
              return reply.code(200).send();
            }

            const integration = integrationList[0];

            try {
              const accessToken = await getValidAccessToken(integration);

              // Define type for Slack unfurl structure
              interface SlackUnfurl {
                blocks: Array<{
                  type: string;
                  text?: {
                    type: string;
                    text: string;
                  };
                  fields?: Array<{
                    type: string;
                    text: string;
                  }>;
                }>;
              }

              const unfurls: Record<string, SlackUnfurl> = {};

              // Process each link
              for (const link of event.links) {
                const url = link.url;

                // Extract job ID from URL (e.g., https://console.getpullrequest.com/jobs/abc-123)
                const jobIdMatch = url.match(/\/jobs\/([a-zA-Z0-9-]+)/);

                if (jobIdMatch) {
                  const jobId = jobIdMatch[1];
                  request.log.info({ jobId }, 'Unfurling job link');

                  // Fetch job details
                  const jobList = await db
                    .select()
                    .from(schema.jobs)
                    .where(
                      and(
                        eq(schema.jobs.id, jobId),
                        eq(schema.jobs.orgId, integration.orgId)
                      )
                    )
                    .limit(1);

                  if (jobList[0]) {
                    const job = jobList[0];

                    // Build unfurl blocks
                    unfurls[url] = {
                      blocks: [
                        {
                          type: 'section',
                          text: {
                            type: 'mrkdwn',
                            text: `*${job.generatedName || 'Untitled Job'}*\n${
                              job.generatedDescription || 'No description'
                            }`,
                          },
                        },
                        {
                          type: 'section',
                          fields: [
                            {
                              type: 'mrkdwn',
                              text: `*Status:*\n${job.status}`,
                            },
                            {
                              type: 'mrkdwn',
                              text: `*Priority:*\n${job.priority}`,
                            },
                            {
                              type: 'mrkdwn',
                              text: `*Queue Position:*\n${
                                job.orderInQueue >= 0 ? job.orderInQueue : 'N/A'
                              }`,
                            },
                            {
                              type: 'mrkdwn',
                              text: `*Created:*\n<!date^${Math.floor(
                                job.createdAt.getTime() / 1000
                              )}^{date_short_pretty}|${job.createdAt.toISOString()}>`,
                            },
                          ],
                        },
                      ],
                    };

                    // Add PR link if available
                    if (job.prLink && unfurls[url]) {
                      unfurls[url].blocks.push({
                        type: 'section',
                        text: {
                          type: 'mrkdwn',
                          text: `🔗 <${job.prLink}|View Pull Request>`,
                        },
                      });
                    }
                  }
                }
              }

              // Send unfurls back to Slack
              if (Object.keys(unfurls).length > 0) {
                const unfurlResponse = await fetch(
                  'https://slack.com/api/chat.unfurl',
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({
                      channel: event.channel,
                      ts: event.message_ts,
                      unfurls,
                    }),
                  }
                );

                const unfurlData = (await unfurlResponse.json()) as {
                  ok: boolean;
                  error?: string;
                };
                if (!unfurlData.ok) {
                  request.log.error(
                    { error: unfurlData.error },
                    'Failed to unfurl links'
                  );
                }
              }
            } catch (err) {
              request.log.error({ err }, 'Failed to process link_shared event');
            }

            return reply.code(200).send();
          }

          // Handle message and app_mention events
          // In channels: Slack sends both 'message' and 'app_mention' events when bot is mentioned
          // In DMs: Only 'message' event is sent
          // To avoid duplicates: process 'app_mention' for channels, 'message' only for DMs
          const isAppMention = eventData.type === 'app_mention';
          const isMessage = eventData.type === 'message';
          const channelType = (eventData as { channel_type?: string })
            .channel_type;

          // Find integration by team ID first (needed to get bot user ID)
          const teamId = (body as { team_id?: string }).team_id as
            | string
            | undefined;
          if (!teamId) {
            request.log.warn('No team_id found in event');
            return reply.code(200).send();
          }

          const integrationList = await db
            .select()
            .from(integrations)
            .where(
              and(
                eq(integrations.providerTeamId, teamId),
                eq(integrations.providerType, 'slack')
              )
            )
            .limit(1);

          if (!integrationList[0]) {
            request.log.warn({ teamId }, 'No integration found for Slack team');
            return reply.code(200).send();
          }

          const integration = integrationList[0];

          // Get bot user ID from authorizations
          const authorizations = body.authorizations as
            | Array<{ user_id?: string }>
            | undefined;
          const botUserId = authorizations?.[0]?.user_id;

          // Check if message mentions the bot (for cases where app_mention event is delayed/missing)
          const event = eventData as unknown as SlackMessageEvent;
          const messageText = event.text || '';
          const messageBlocks =
            (eventData as { blocks?: Array<Record<string, unknown>> }).blocks ||
            [];

          // Check if message mentions the bot in text or blocks
          let mentionsBot = isAppMention;
          if (!mentionsBot && botUserId) {
            // Check text for mention
            mentionsBot =
              messageText.includes(`<@${botUserId}>`) ||
              messageText.toLowerCase().includes('@sia');

            // Check blocks for mention
            if (!mentionsBot && messageBlocks.length > 0) {
              const blocksText = JSON.stringify(messageBlocks);
              mentionsBot =
                blocksText.includes(`<@${botUserId}>`) ||
                blocksText.toLowerCase().includes('@sia') ||
                blocksText.includes(`"user_id":"${botUserId}"`);
            }
          }

          // Check if this is Sia joining a channel
          const isChannelJoin = isMessage && event.subtype === 'channel_join';
          const joiningUser = (eventData as { user?: string }).user;
          const isSiaJoining = isChannelJoin && joiningUser === botUserId;

          if (isSiaJoining) {
            // Sia is joining the channel - send an excited intro message
            request.log.info(
              { channel: event.channel },
              'Sia joining channel, sending intro message'
            );

            try {
              const accessToken = await getValidAccessToken(integration);
              const introMessage =
                "Hey team! 👋 Super excited to be here! I'm Sia, your friendly dev intern assistant. I'm here to help with task management, checking job statuses, creating tasks, and all sorts of coding platform stuff. Just @mention me anytime you need help - I'm ready to dive in!";

              await fetch('https://slack.com/api/chat.postMessage', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                  channel: event.channel,
                  text: introMessage,
                }),
              });

              return reply.code(200).send();
            } catch (err) {
              request.log.error(
                { err },
                'Failed to send channel join intro message'
              );
              return reply.code(200).send();
            }
          }

          // Process all message events (channels and DMs)
          // For channels: process both message and app_mention events
          // For DMs: only message events are sent
          // Skip app_mention events in channels if we already processed the message event
          // (Slack sends both, we'll process the message event for channels)

          // Skip app_mention events in channels (we process message events instead)
          if (isAppMention && channelType === 'channel') {
            request.log.info(
              { eventType: 'app_mention', channelType },
              'Skipping app_mention in channel (will process message event instead)'
            );
            return reply.code(200).send();
          }

          // Process message events (channels and DMs) and app_mention events (only for DMs if any)
          const shouldProcess =
            isMessage || (isAppMention && channelType === 'im');

          if (shouldProcess) {
            // Ignore bot messages
            if (event.bot_id || event.subtype === 'bot_message') {
              request.log.info('Ignoring bot message');
              return reply.code(200).send();
            }

            // Ignore system messages (channel_join, channel_leave, etc.) - we already handled Sia's join above
            if (
              event.subtype &&
              event.subtype !== 'message_changed' &&
              event.subtype !== 'message_deleted'
            ) {
              request.log.info(
                { subtype: event.subtype },
                'Ignoring system message'
              );
              return reply.code(200).send();
            }

            request.log.info(
              { integrationId: integration.id },
              'Found integration, processing message'
            );

            // Use conversation manager and queue manager for natural language processing
            const { SlackAdapter } = await import(
              '../services/messaging/adapters/slack-adapter.js'
            );
            const { conversationManager } = await import(
              '../services/messaging/conversation-manager.js'
            );
            const { messageQueueManager } = await import(
              '../services/messaging/message-queue-manager.js'
            );
            const { ConversationalHandler } = await import(
              '../services/messaging/conversational-handler.js'
            );

            try {
              const accessToken = await getValidAccessToken(integration);
              const adapter = new SlackAdapter(accessToken);

              // Parse message
              const message = await adapter.parseIncomingMessage(event);

              // Add orgId and channel type to metadata for handlers
              message.metadata.orgId = integration.orgId;
              message.metadata.isDM = channelType === 'im';
              message.metadata.channelType = channelType;

              // Download attachments if any
              if (message.attachments && message.attachments.length > 0) {
                for (const attachment of message.attachments) {
                  try {
                    const localPath = await adapter.downloadAttachment(
                      attachment
                    );
                    attachment.localPath = localPath;
                  } catch (err) {
                    request.log.error({ err }, 'Failed to download attachment');
                  }
                }
              }

              // Determine if this is a mention (@mention or app_mention event)
              const isMention = isAppMention || mentionsBot;

              // Quick relevance check for non-mentions in channels
              // For mentions and DMs, always process
              let shouldProcessMessage = isMention || channelType === 'im';

              if (!shouldProcessMessage && channelType === 'channel') {
                // Check relevance for channel messages that aren't mentions
                const handler = new ConversationalHandler();
                handler.setLogger(request.log);
                const relevanceCheck = handler.detectQuestionRelevance(
                  message.text
                );

                // Only process if high relevance
                shouldProcessMessage =
                  relevanceCheck.confidence === 'high_related';

                if (!shouldProcessMessage) {
                  request.log.info(
                    {
                      messageId: message.id,
                      confidence: relevanceCheck.confidence,
                    },
                    'Skipping message - low relevance'
                  );
                  return reply.code(200).send();
                }
              }

              // Determine priority: mentions = high, others = normal
              const priority: 'high' | 'normal' = isMention ? 'high' : 'normal';

              if (priority === 'high') {
                // @mentions: process immediately
                conversationManager
                  .handleMessage(
                    message,
                    adapter,
                    integration.orgId,
                    request.log,
                    isMention
                  )
                  .catch(err => {
                    request.log.error({ err }, 'Error handling message');
                  });
              } else {
                // Others: queue for processing
                messageQueueManager.enqueue(
                  message,
                  adapter,
                  integration.orgId,
                  priority,
                  request.log
                );
              }
            } catch (err) {
              request.log.error({ err }, 'Failed to process Slack message');
            }
          }
        }

        return reply.code(200).send();
      } catch (error) {
        request.log.error(
          { err: error },
          'Unhandled error in Slack events endpoint'
        );
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  fastify.log.info('Slack routes initialized successfully');
}

export default slackRoutes;

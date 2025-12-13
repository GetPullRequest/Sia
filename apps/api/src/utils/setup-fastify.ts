import { FastifyInstance, FastifyRequest } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import jobsRoutes from '../routes/jobs';
import jobLogsRoutes from '../routes/job-logs';
import reposRoutes from '../routes/github';
import slackRoutes from '../routes/slack';
import activitiesRoutes from '../routes/activities';
import agentsRoutes from '../routes/agents';
import integrationSecretsRoutes from '../routes/integration-secrets';
import apiKeysRoutes from '../routes/api-keys';
import { registerSchemas } from './register-schemas';

export interface SetupFastifyOptions {
  logger?: boolean;
  enableSwaggerUi?: boolean;
  enableCors?: boolean;
  enableWebSocket?: boolean;
}

export async function setupFastify(
  fastify: FastifyInstance,
  options: SetupFastifyOptions = {}
): Promise<void> {
  const {
    enableSwaggerUi = true,
    enableCors = true,
    enableWebSocket = true,
  } = options;

  // Configure request-scoped logger to automatically include reqId
  // This hook runs early to ensure reqId is available for all subsequent logs
  fastify.addHook('onRequest', async (request, _reply) => {
    // Fastify's genReqId should have set request.id, but ensure it exists
    // If not, generate one (this should rarely happen)
    const reqId =
      request.id || `req-${Math.random().toString(36).substring(2, 9)}`;
    if (!request.id) {
      request.id = reqId;
    }

    // Create a child logger with reqId that will be used for all logs in this request
    // This ensures all logs within this request context have the reqId
    request.log = request.log.child({ reqId });

    request.log.info(
      {
        method: request.method,
        url: request.url,
        headers: request.headers,
        query: request.query,
        body: request.body,
      },
      'Incoming request'
    );
  });

  fastify.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      `Request completed - ${reply.statusCode}`
    );
  });

  // Register CORS support (only if enabled)
  if (enableCors) {
    await fastify.register(cors, {
      origin: (origin, cb) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return cb(null, true);

        // Get allowed origins from environment or default to localhost and common ngrok patterns
        const allowedOrigins = process.env.ALLOWED_ORIGINS
          ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
          : [
              'http://localhost:3000',
              'http://localhost:3001',
              'https://api-staging.getpullrequest.com',
              'https://api.getpullrequest.com',
              'https://console.getpullrequest.com',
              'https://console-staging.getpullrequest.com',
              /^https:\/\/.*\.zrok\.io$/,
              /^https:\/\/.*\.ngrok-free\.app$/,
              /^https:\/\/.*\.ngrok\.io$/,
              /^https:\/\/.*\.ngrok-app\.com$/,
              /^https:\/\/.*\.ngrok-free\.dev$/,
            ];

        // Check if origin matches any allowed pattern
        const isAllowed = allowedOrigins.some(allowed => {
          if (typeof allowed === 'string') {
            return origin === allowed;
          }
          if (allowed instanceof RegExp) {
            return allowed.test(origin);
          }
          return false;
        });

        if (isAllowed) {
          cb(null, true);
        } else {
          cb(new Error('Not allowed by CORS'), false);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['Location'], // Expose Location header for redirects
    });
  }

  // Register WebSocket support (only if enabled)
  if (enableWebSocket) {
    await fastify.register(websocket);
  }

  // Register cookie support
  await fastify.register(cookie);

  // Add raw body parser for Slack signature verification
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    async (req: FastifyRequest, body: string) => {
      // Store raw body for signature verification
      (req as FastifyRequest & { rawBody?: string }).rawBody = body;
      // Handle empty bodies gracefully
      if (!body || body.trim() === '') {
        return undefined;
      }
      // Parse and return JSON
      try {
        return JSON.parse(body);
      } catch {
        throw new Error('Invalid JSON');
      }
    }
  );

  // Register schemas globally (like FastAPI - define once, use everywhere)
  // Fastify will automatically generate OpenAPI components.schemas from these
  // TypeBox schemas are JSON Schema compatible, just add $id for references
  registerSchemas(fastify);

  // Register Swagger for OpenAPI spec generation
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Sia - Agent Orchestration API',
        description:
          'Sia connects with code generation agents and receives your requests from Slack, Discord, or through Sia mobile app. It picks up the task, schedules it, and gets it done like your personal dev assistant.',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3001',
          description: 'Development server',
        },
      ],
      tags: [
        { name: 'jobs', description: 'Job management endpoints' },
        { name: 'job-logs', description: 'Job logs endpoints' },
        { name: 'repos', description: 'Repository management endpoints' },
        {
          name: 'integrations',
          description: 'Integration management endpoints',
        },
        { name: 'activities', description: 'Activity management endpoints' },
        { name: 'agents', description: 'Agent management endpoints' },
        { name: 'queues', description: 'Queue management endpoints' },
        { name: 'api-keys', description: 'API key management endpoints' },
      ],
    },
    refResolver: {
      buildLocalReference(json, baseUri, fragment, i): string {
        // Use the $id as the schema name in components.schemas
        return (json.$id as string) || `def-${i}`;
      },
    },
  });

  // Register Swagger UI (only if enabled)
  if (enableSwaggerUi) {
    await fastify.register(swaggerUi, {
      routePrefix: '/documentation',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
      staticCSP: true,
      transformStaticCSP: header => header,
    });
  }

  // Register all routes
  // Using fastify.log (root logger) - reqId will be 'startup' from mixin
  fastify.log.info('Registering routes...');
  await fastify.register(jobsRoutes);
  fastify.log.info('✓ Jobs routes registered');
  await fastify.register(jobLogsRoutes);
  fastify.log.info('✓ Job logs routes registered');
  await fastify.register(reposRoutes);
  fastify.log.info('✓ Repos routes registered');
  await fastify.register(slackRoutes);
  fastify.log.info('✓ Slack routes registered');
  await fastify.register(activitiesRoutes);
  fastify.log.info('✓ Activities routes registered');
  await fastify.register(agentsRoutes);
  fastify.log.info('✓ Agents routes registered');
  await fastify.register(integrationSecretsRoutes);
  fastify.log.info('✓ Integration secrets routes registered');
  await fastify.register(apiKeysRoutes);
  fastify.log.info('✓ API keys routes registered');
}

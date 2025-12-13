import 'dotenv/config';
import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { setupFastify } from './utils/setup-fastify';
import { resolve } from 'path';
import { startTemporalWorker } from './temporal/worker';
import { initializeQueueWorkflows } from './services/queue-initialization';
import { BackendGrpcServer } from './services/backend-grpc-server';

const fastify = Fastify({
  logger: {
    transport:
      process.env.NODE_ENV === 'production'
        ? undefined
        : {
            target: resolve(process.cwd(), 'custom-transport.mjs'),
            options: {},
          },
    serializers: {
      // Automatically add reqId to all logs if available in the request context
      req: (req: {
        id?: string;
        headers?: Record<string, string | string[] | undefined>;
        method?: string;
        url?: string;
      }) => {
        const xRequestId = req.headers?.['x-request-id'];
        const requestId = Array.isArray(xRequestId)
          ? xRequestId[0]
          : xRequestId;
        return {
          id: req.id || requestId || 'startup',
          method: req.method,
          url: req.url,
        };
      },
    },
    genReqId: req => {
      // Generate a short request ID
      const xRequestId = req.headers['x-request-id'];
      if (xRequestId) {
        return Array.isArray(xRequestId) ? xRequestId[0] : xRequestId;
      }
      return req.id || `req-${Math.random().toString(36).substring(2, 9)}`;
    },
    // Automatically include request ID in all logs via a custom mixin
    mixin: () => {
      // This runs for root logger (startup logs)
      return { reqId: 'startup' };
    },
  },
});

const start = async () => {
  try {
    // Setup Fastify with all plugins, schemas, and routes
    console.log('Setting up Fastify...');
    await setupFastify(fastify);
    console.log('Fastify setup complete');

    fastify.get('/', async (_request: FastifyRequest, _reply: FastifyReply) => {
      return { hello: 'world' };
    });

    // Log all registered routes
    console.log('\n📋 Registered routes:');
    fastify.printRoutes();

    // Start gRPC server for agent communication
    const grpcPort = parseInt(process.env.GRPC_SERVER_PORT || '50052', 10);
    const grpcServer = new BackendGrpcServer();
    grpcServer.start(grpcPort, '0.0.0.0');

    // Start Temporal worker in background
    if (process.env.ENABLE_TEMPORAL_WORKER !== 'false') {
      startTemporalWorker().catch(err => {
        console.error('Failed to start Temporal worker:', err);
        // Don't exit - API can still work without worker
      });

      // Initialize queue workflows for all organizations
      initializeQueueWorkflows().catch(err => {
        console.error('Failed to initialize queue workflows:', err);
        // Don't exit - workflows can be started manually later
      });
    }

    const port = parseInt(process.env.PORT || '3001', 10);
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`\n🚀 Fastify server listening on http://0.0.0.0:${port}`);
    console.log(
      `📚 OpenAPI spec available at http://0.0.0.0:${port}/documentation/json`
    );
    console.log(
      `📖 Swagger UI available at http://0.0.0.0:${port}/documentation`
    );
    console.log(`🔌 gRPC server listening on 0.0.0.0:${grpcPort}`);
  } catch (err) {
    fastify.log.error(err);
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();

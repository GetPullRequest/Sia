import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';

export async function createTemporalWorker() {
  const address = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
  const apiKey = process.env.TEMPORAL_API_KEY;
  const namespace = process.env.TEMPORAL_NAMESPACE || 'default';

  const connectionOptions: {
    address: string;
    tls?: Record<string, never>;
    metadata?: { authorization: string };
  } = {
    address,
  };

  // Only add TLS/auth for Cloud
  if (apiKey) {
    connectionOptions.tls = {};
    connectionOptions.metadata = {
      authorization: `Bearer ${apiKey}`,
    };
  }

  const connection = await NativeConnection.connect(connectionOptions);

  // Resolve workflows directory - now that we have an index.ts file, this should work
  const workflowsPath = require.resolve('./workflows');
  
  const worker = await Worker.create({
    connection,
    namespace,
    taskQueue: 'job-queue',
    workflowsPath,
    activities,
    maxConcurrentActivityTaskExecutions: 1, // Sequential execution
    bundlerOptions: {
      // Ignore modules that are only used in activities, not workflows
      // These modules are disallowed in workflow context but safe to ignore
      // since workflows only use 'import type' for activities
      // This is the recommended Temporal approach for dependencies that are activity-only
      ignoreModules: [
        '@temporalio/client',
        'events',
        'net',
        'dns',
        'tls',
        'crypto',
        'path',
        'fs',
        'stream',
        'string_decoder',
        'pg-native', // Optional native binding for pg
      ],
    },
  });

  return worker;
}

export async function startTemporalWorker() {
  console.log('Starting Temporal worker...');
  try {
    const worker = await createTemporalWorker();
    console.log('Temporal worker started');
    await worker.run();
  } catch (error) {
    console.error('Failed to start Temporal worker:', error);
    throw error;
  }
}


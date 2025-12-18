import { AgentServer } from './server.js';
import { BackendGrpcClient } from './api/backend-grpc-client.js';
import { BackendStreamMessageType } from '@sia/models/proto';
import { ContainerManager } from './container/container-manager.js';
import { LocalExecutionManager } from './container/local-execution-manager.js';
import type { IExecutionManager } from './container/execution-manager.interface.js';

function parseArgs(): {
  apiKey: string;
  port: number;
  backendUrl: string;
  containerImage?: string;
  local: boolean;
  workspaceDir?: string;
} {
  const args = process.argv.slice(2);
  let apiKey = '';
  let port = 50051;
  let backendUrl = '';
  let containerImage: string | undefined;
  let local = false;
  let workspaceDir: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--api-key' && args[i + 1]) {
      apiKey = args[i + 1];
      i++;
    } else if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--backend-url' && args[i + 1]) {
      backendUrl = args[i + 1];
      i++;
    } else if (args[i] === '--container-image' && args[i + 1]) {
      containerImage = args[i + 1];
      i++;
    } else if (args[i] === '--local') {
      local = true;
    } else if (args[i] === '--workspace-dir' && args[i + 1]) {
      workspaceDir = args[i + 1];
      i++;
    }
  }

  if (!apiKey) {
    apiKey = process.env.SIA_API_KEY || '';
  }
  if (!backendUrl) {
    backendUrl = process.env.SIA_BACKEND_URL || 'localhost:50052';
  }
  if (!containerImage) {
    containerImage = process.env.SIA_CONTAINER_IMAGE || 'sia-dev-env:latest';
  }
  if (!workspaceDir) {
    workspaceDir = process.env.SIA_WORKSPACE_DIR;
  }

  if (!apiKey) {
    console.error(
      'Error: --api-key is required or set SIA_API_KEY environment variable'
    );
    process.exit(1);
  }

  return { apiKey, port, backendUrl, containerImage, local, workspaceDir };
}

async function main() {
  const { apiKey, port, backendUrl, containerImage, local, workspaceDir } =
    parseArgs();

  // Add global error handlers to prevent agent crashes
  process.on('uncaughtException', error => {
    console.error('Uncaught Exception:', error);
    console.error('Agent will continue running...');
    // Don't exit - let the agent continue serving requests
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    console.error('Agent will continue running...');
    // Don't exit - let the agent continue serving requests
  });

  console.log(`Starting SIA Agent on port ${port}...`);
  console.log(`Connecting to backend at ${backendUrl}...`);

  let executionManager!: IExecutionManager;

  if (local) {
    console.log('Running in LOCAL mode (no Docker)');
    if (workspaceDir) {
      console.log(`Using workspace directory: ${workspaceDir}`);
    }

    // Initialize LocalExecutionManager
    executionManager = new LocalExecutionManager({
      workspaceDir,
    });

    console.log('Ensuring local workspace is ready...');
    try {
      if (executionManager.ensureWorkspaceReady) {
        await executionManager.ensureWorkspaceReady();
      }
      console.log('Local workspace is ready');
    } catch (error) {
      console.error('Failed to setup local workspace:', error);
      process.exit(1);
    }
  } else {
    console.log('Running in CONTAINER mode');
    console.log(`Using container image: ${containerImage}`);

    // Initialize ContainerManager
    executionManager = new ContainerManager({
      image: containerImage,
    });

    console.log('Ensuring dev container is ready...');
    try {
      if (executionManager.ensureContainerRunning) {
        await executionManager.ensureContainerRunning();
      }
      console.log('Dev container is ready');
    } catch (error) {
      console.error('Failed to start dev container:', error);
      console.error(
        'Please ensure Docker is running and the container image is available'
      );
      process.exit(1);
    }
  }

  const backendClient = new BackendGrpcClient({
    backendUrl,
    apiKey,
    port,
  });

  // Create JobVibePlatform with workspace configuration
  const { JobVibePlatform } = await import('./vibe/job-vibe-platform.js');
  const vibePlatform = new JobVibePlatform({
    workspacePath: workspaceDir,
    containerImage: local ? undefined : containerImage,
  });

  const server = new AgentServer(vibePlatform, backendClient);
  server.start(port, '0.0.0.0');

  try {
    const registrationResult = await backendClient.register();
    if (!registrationResult.success) {
      console.error('Failed to register agent:', registrationResult.message);
      process.exit(1);
    }

    console.log(
      `Agent registered successfully. Agent ID: ${registrationResult.agentId}`
    );

    backendClient.startStream(registrationResult.agentId, message => {
      if (message.messageType === BackendStreamMessageType.HEALTH_CHECK_PING) {
        backendClient.sendHeartbeat();
        console.log(
          'Heartbeat successfully sent in response to health check ping'
        );
      } else if (
        message.messageType === BackendStreamMessageType.TASK_ASSIGNMENT
      ) {
        const taskData = JSON.parse(message.payload.toString());
        console.log('Received task assignment:', taskData);
      }
    });

    process.on('SIGINT', async () => {
      console.log('\nShutting down agent...');
      console.log('Stopping execution environment...');
      await executionManager.stopContainer();
      backendClient.close();
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nReceived SIGTERM, shutting down agent...');
      console.log('Stopping execution environment...');
      await executionManager.stopContainer();
      backendClient.close();
      await server.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to register agent:', error);
    process.exit(1);
  }
}

main();

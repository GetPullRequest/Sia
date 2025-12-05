import { AgentServer } from './server.js';
import { BackendGrpcClient } from './api/backend-grpc-client.js';
import { BackendStreamMessageType } from '@sia/models/proto';

function parseArgs(): {
  apiKey: string;
  port: number;
  backendUrl: string;
} {
  const args = process.argv.slice(2);
  let apiKey = '';
  let port = 50051;
  let backendUrl = '';

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
    }
  }

  if (!apiKey) {
    apiKey = process.env.SIA_API_KEY || '';
  }
  if (!backendUrl) {
    backendUrl = process.env.SIA_BACKEND_URL || 'localhost:50052';
  }

  if (!apiKey) {
    console.error('Error: --api-key is required or set SIA_API_KEY environment variable');
    process.exit(1);
  }

  return { apiKey, port, backendUrl };
}

async function main() {
  const { apiKey, port, backendUrl } = parseArgs();

  console.log(`Starting agent on port ${port}...`);
  const server = new AgentServer();
  server.start(port, '0.0.0.0');

  console.log(`Connecting to backend at ${backendUrl}...`);
  const backendClient = new BackendGrpcClient({
    backendUrl,
    apiKey,
    port,
  });

  try {
    const registrationResult = await backendClient.register();
    if (!registrationResult.success) {
      console.error('Failed to register agent:', registrationResult.message);
      process.exit(1);
    }

    console.log(`Agent registered successfully. Agent ID: ${registrationResult.agentId}`);

    backendClient.startStream(registrationResult.agentId, (message) => {
      if (message.messageType === BackendStreamMessageType.HEALTH_CHECK_PING) {
        backendClient.sendHeartbeat();
      } else if (message.messageType === BackendStreamMessageType.TASK_ASSIGNMENT) {
        const taskData = JSON.parse(message.payload.toString());
        console.log('Received task assignment:', taskData);
      }
    });

    setInterval(() => {
      backendClient.sendHeartbeat();
    }, 30000);

    process.on('SIGINT', async () => {
      console.log('\nShutting down server...');
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


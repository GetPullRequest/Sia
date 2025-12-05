import * as grpc from '@grpc/grpc-js';
import {
  AgentServiceClient,
  type RegisterAgentRequest,
  type RegisterAgentResponse,
  type AgentStreamRequest,
  type AgentStreamMessage,
  AgentStreamMessageType,
} from '@sia/models/proto';
import * as os from 'os';

export interface BackendGrpcClientOptions {
  backendUrl: string;
  apiKey: string;
  port: number;
}

export class BackendGrpcClient {
  private client: AgentServiceClient;
  private backendUrl: string;
  private apiKey: string;
  private port: number;
  private stream: grpc.ClientDuplexStream<AgentStreamRequest, AgentStreamMessage> | null = null;
  private streamListeners: Map<string, (message: AgentStreamMessage) => void> = new Map();

  constructor(options: BackendGrpcClientOptions) {
    this.backendUrl = options.backendUrl;
    this.apiKey = options.apiKey;
    this.port = options.port;
    this.client = new AgentServiceClient(
      this.backendUrl,
      grpc.credentials.createInsecure()
    );
  }

  async register(): Promise<RegisterAgentResponse> {
    const hostname = os.hostname();
    const networkInterfaces = os.networkInterfaces();
    let ipAddress = '127.0.0.1';

    for (const interfaces of Object.values(networkInterfaces)) {
      if (!interfaces) continue;
      for (const iface of interfaces) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ipAddress = iface.address;
          break;
        }
      }
      if (ipAddress !== '127.0.0.1') break;
    }

    const request: RegisterAgentRequest = {
      apiKey: this.apiKey,
      hostname,
      ipAddress,
      port: this.port,
    };

    return new Promise((resolve, reject) => {
      this.client.registerAgent(
        request,
        (error: grpc.ServiceError | null, response: RegisterAgentResponse) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  startStream(agentId: string, onMessage: (message: AgentStreamMessage) => void): void {
    if (this.stream) {
      this.stream.end();
    }

    this.stream = this.client.agentStream();
    this.streamListeners.set('default', onMessage);

    this.stream.on('data', (message: AgentStreamMessage) => {
      const listener = this.streamListeners.get('default');
      if (listener) {
        listener(message);
      }
    });

    this.stream.on('error', (error) => {
      console.error('Stream error:', error);
      this.stream = null;
    });

    this.stream.on('end', () => {
      console.log('Stream ended');
      this.stream = null;
    });

    const initialRequest: AgentStreamRequest = {
      agentId,
      messageType: AgentStreamMessageType.STATUS_UPDATE,
      payload: Buffer.from(JSON.stringify({ status: 'connected' })),
    };

    this.stream.write(initialRequest);
  }

  sendLogMessage(jobId: string, level: string, message: string, stage: string): void {
    if (!this.stream) {
      console.warn('Stream not connected, cannot send log message');
      return;
    }

    const logRequest: AgentStreamRequest = {
      agentId: '', // Will be set by backend
      messageType: AgentStreamMessageType.LOG_MESSAGE,
      payload: Buffer.from(
        JSON.stringify({
          jobId,
          level,
          message,
          timestamp: new Date().toISOString(),
          stage,
        })
      ),
    };

    this.stream.write(logRequest);
  }

  sendHeartbeat(): void {
    if (!this.stream) {
      return;
    }

    const heartbeatRequest: AgentStreamRequest = {
      agentId: '',
      messageType: AgentStreamMessageType.HEARTBEAT,
      payload: Buffer.from(JSON.stringify({ timestamp: Date.now() })),
    };

    this.stream.write(heartbeatRequest);
  }

  close(): void {
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
    this.client.close();
  }
}


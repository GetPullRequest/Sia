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
  private stream: grpc.ClientDuplexStream<
    AgentStreamRequest,
    AgentStreamMessage
  > | null = null;
  private streamListeners: Map<string, (message: AgentStreamMessage) => void> =
    new Map();
  private agentId: string | null = null;
  private onMessageCallback: ((message: AgentStreamMessage) => void) | null =
    null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = Infinity;
  private baseReconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private shouldReconnect = true;

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

  startStream(
    agentId: string,
    onMessage: (message: AgentStreamMessage) => void
  ): void {
    this.agentId = agentId;
    this.onMessageCallback = onMessage;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.connectStream();
  }

  private connectStream(): void {
    if (!this.shouldReconnect || !this.agentId || !this.onMessageCallback) {
      return;
    }

    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }

    try {
      this.stream = this.client.agentStream();
      this.streamListeners.set('default', this.onMessageCallback);

      this.stream.on('data', (message: AgentStreamMessage) => {
        const listener = this.streamListeners.get('default');
        if (listener) {
          listener(message);
        }
        this.reconnectAttempts = 0;
      });

      this.stream.on('error', error => {
        console.error('Stream error:', error);
        this.stream = null;
        this.scheduleReconnect();
      });

      this.stream.on('end', () => {
        console.log('Stream ended');
        this.stream = null;
        this.scheduleReconnect();
      });

      const initialRequest: AgentStreamRequest = {
        agentId: this.agentId,
        messageType: AgentStreamMessageType.STATUS_UPDATE,
        payload: Buffer.from(JSON.stringify({ status: 'connected' })),
      };

      this.stream.write(initialRequest);
      this.reconnectAttempts = 0;
      console.log('Stream connected successfully');
    } catch (error) {
      console.error('Failed to create stream:', error);
      this.stream = null;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) {
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        `Max reconnection attempts (${this.maxReconnectAttempts}) reached. Stopping reconnection.`
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(
      `Scheduling stream reconnection in ${delay}ms (attempt ${this.reconnectAttempts})`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (this.shouldReconnect) {
        console.log('Attempting to reconnect stream...');
        this.connectStream();
      }
    }, delay);
  }

  sendLogMessage(
    jobId: string,
    level: string,
    message: string,
    stage: string
  ): void {
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
    this.shouldReconnect = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
    this.client.close();
  }
}

import * as grpc from '@grpc/grpc-js';
import type {
  AgentStreamRequest,
  AgentStreamMessage,
  BackendStreamMessageType,
} from '@sia/models/proto';

interface AgentStreamConnection {
  call: grpc.ServerDuplexStream<AgentStreamRequest, AgentStreamMessage>;
  agentId: string;
  orgId: string;
  connectedAt: Date;
}

export class AgentStreamManager {
  private connections: Map<string, AgentStreamConnection> = new Map();

  registerStream(
    agentId: string,
    orgId: string,
    call: grpc.ServerDuplexStream<AgentStreamRequest, AgentStreamMessage>
  ): void {
    const connection: AgentStreamConnection = {
      call,
      agentId,
      orgId,
      connectedAt: new Date(),
    };

    this.connections.set(agentId, connection);

    call.on('end', () => {
      this.unregisterStream(agentId);
    });

    call.on('error', (error) => {
      console.error(`Stream error for agent ${agentId}:`, error);
      this.unregisterStream(agentId);
    });
  }

  unregisterStream(agentId: string): void {
    const connection = this.connections.get(agentId);
    if (connection) {
      try {
        connection.call.end();
      } catch (error) {
        // Stream might already be closed
      }
      this.connections.delete(agentId);
    }
  }

  getStream(agentId: string): AgentStreamConnection | undefined {
    return this.connections.get(agentId);
  }

  hasStream(agentId: string): boolean {
    return this.connections.has(agentId);
  }

  async sendMessage(
    agentId: string,
    messageType: BackendStreamMessageType,
    payload: unknown
  ): Promise<boolean> {
    const connection = this.connections.get(agentId);
    if (!connection) {
      return false;
    }

    try {
      const message: AgentStreamMessage = {
        messageId: `${Date.now()}-${Math.random()}`,
        messageType,
        payload: Buffer.from(JSON.stringify(payload)),
      };

      connection.call.write(message);
      return true;
    } catch (error) {
      console.error(`Failed to send message to agent ${agentId}:`, error);
      this.unregisterStream(agentId);
      return false;
    }
  }

  getAllAgentIds(): string[] {
    return Array.from(this.connections.keys());
  }

  getAgentIdsByOrg(orgId: string): string[] {
    return Array.from(this.connections.values())
      .filter((conn) => conn.orgId === orgId)
      .map((conn) => conn.agentId);
  }
}

export const agentStreamManager = new AgentStreamManager();


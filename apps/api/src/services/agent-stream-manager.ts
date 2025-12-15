import * as grpc from '@grpc/grpc-js';
import type {
  AgentStreamRequest,
  AgentStreamMessage,
  BackendStreamMessageType,
} from '@sia/models/proto';
import { db, schema } from '../db/index.js';
import { eq, and, gte, isNotNull } from 'drizzle-orm';

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

    call.on('error', error => {
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

  /**
   * Get the local stream connection for an agent.
   * Note: This only returns connections that exist on this machine.
   * For stateless checks, use hasStream() instead.
   */
  getStream(agentId: string): AgentStreamConnection | undefined {
    return this.connections.get(agentId);
  }

  async sendMessage(
    agentId: string,
    messageType: BackendStreamMessageType,
    payload: unknown
  ): Promise<boolean> {
    // Check if we have a local connection (required for actual sending)
    const connection = this.connections.get(agentId);
    if (!connection) {
      // Agent is connected but not on this machine
      // This is expected in a multi-machine setup - only the machine with
      // the actual TCP connection can send messages
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

  async getAllAgentIds(): Promise<string[]> {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const agents = await db
      .select({ id: schema.agents.id })
      .from(schema.agents)
      .where(
        and(
          isNotNull(schema.agents.lastStreamConnectedAt),
          gte(schema.agents.lastStreamConnectedAt, twoMinutesAgo)
        )
      );
    return agents.map(agent => agent.id);
  }

  async getAgentIdsByOrg(orgId: string): Promise<string[]> {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const agents = await db
      .select({ id: schema.agents.id })
      .from(schema.agents)
      .where(
        and(
          eq(schema.agents.orgId, orgId),
          isNotNull(schema.agents.lastStreamConnectedAt),
          gte(schema.agents.lastStreamConnectedAt, twoMinutesAgo)
        )
      );
    return agents.map(agent => agent.id);
  }
}

export const agentStreamManager = new AgentStreamManager();

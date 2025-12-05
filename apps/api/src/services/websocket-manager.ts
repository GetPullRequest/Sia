import type { WebSocket } from 'ws';

interface WebSocketConnection {
  socket: WebSocket;
  jobId: string;
}

export class WebSocketManager {
  private connections: Map<string, Set<WebSocketConnection>> = new Map();

  subscribe(jobId: string, socket: WebSocket): void {
    if (!this.connections.has(jobId)) {
      this.connections.set(jobId, new Set());
    }

    const connection: WebSocketConnection = { socket, jobId };
    const jobConnections = this.connections.get(jobId);
    if (jobConnections) {
      jobConnections.add(connection);
    }

    socket.on('close', () => {
      this.unsubscribe(jobId, socket);
    });
  }

  unsubscribe(jobId: string, socket: WebSocket): void {
    const connections = this.connections.get(jobId);
    if (connections) {
      for (const conn of connections) {
        if (conn.socket === socket) {
          connections.delete(conn);
          break;
        }
      }

      if (connections.size === 0) {
        this.connections.delete(jobId);
      }
    }
  }

  hasSubscribers(jobId: string): boolean {
    const connections = this.connections.get(jobId);
    return connections !== undefined && connections.size > 0;
  }

  broadcast(jobId: string, message: unknown): void {
    const connections = this.connections.get(jobId);
    if (!connections) {
      return;
    }

    const messageStr = JSON.stringify(message);
    const toRemove: WebSocketConnection[] = [];

    for (const conn of connections) {
      if (conn.socket.readyState === 1) {
        try {
          conn.socket.send(messageStr);
        } catch (error) {
          console.error(`Failed to send message to ${jobId}:`, error);
          toRemove.push(conn);
        }
      } else {
        toRemove.push(conn);
      }
    }

    toRemove.forEach(conn => this.unsubscribe(jobId, conn.socket));
  }

  getSubscriberCount(jobId: string): number {
    return this.connections.get(jobId)?.size || 0;
  }
}

export const websocketManager = new WebSocketManager();


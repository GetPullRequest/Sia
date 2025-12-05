import type { IncomingMessage } from './messaging-types';
import type { MessagingAdapter } from './messaging-adapter';
import { conversationManager } from './conversation-manager';

/**
 * Queued message with priority
 */
interface QueuedMessage {
  message: IncomingMessage;
  adapter: MessagingAdapter;
  orgId: string;
  priority: 'high' | 'normal'; // high = @mention, normal = others
  timestamp: number;
  logger?: any;
}

/**
 * Manages in-memory priority queue for message processing
 * Platform-agnostic: works with any messaging platform
 */
export class MessageQueueManager {
  private queue: QueuedMessage[] = [];
  private maxSize = 30;
  private processing = false;
  private processInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start queue processor
    this.startProcessor();
  }

  /**
   * Add message to queue
   * High priority (mentions) go to front, normal priority to end
   */
  enqueue(
    message: IncomingMessage,
    adapter: MessagingAdapter,
    orgId: string,
    priority: 'high' | 'normal',
    logger?: any
  ): void {
    const queued: QueuedMessage = {
      message,
      adapter,
      orgId,
      priority,
      timestamp: Date.now(),
      logger,
    };

    // Insert by priority (high first)
    if (priority === 'high') {
      this.queue.unshift(queued); // Add to front
    } else {
      this.queue.push(queued); // Add to end
    }

    // Trim to max size (remove oldest normal priority first)
    if (this.queue.length > this.maxSize) {
      // Find oldest normal priority message
      const normalPriority = this.queue.filter(q => q.priority === 'normal');
      if (normalPriority.length > 0) {
        const oldest = normalPriority[normalPriority.length - 1]; // Oldest is at end
        const index = this.queue.indexOf(oldest);
        if (index !== -1) {
          this.queue.splice(index, 1);
        }
      } else {
        // If all high priority, remove oldest high priority
        this.queue.pop();
      }
    }

    logger?.info({ 
      queueSize: this.queue.length,
      priority,
      messageId: message.id 
    }, 'Message enqueued');
  }

  /**
   * Start processing queue
   */
  private startProcessor(): void {
    // Process queue every 500ms when not busy
    this.processInterval = setInterval(async () => {
      if (!this.processing && this.queue.length > 0) {
        await this.processNext();
      }
    }, 500);
  }

  /**
   * Process next message in queue
   */
  private async processNext(): Promise<void> {
    if (this.queue.length === 0) return;

    this.processing = true;
    const item = this.queue.shift()!;

    try {
      item.logger?.info({ 
        messageId: item.message.id,
        priority: item.priority,
        queueSize: this.queue.length 
      }, 'Processing queued message');

      await conversationManager.handleMessage(
        item.message,
        item.adapter,
        item.orgId,
        item.logger
      );
    } catch (error) {
      item.logger?.error({ err: error, messageId: item.message.id }, 'Error processing queued message');
    } finally {
      this.processing = false;
    }
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Clear queue (useful for testing or reset)
   */
  clearQueue(): void {
    this.queue = [];
  }

  /**
   * Stop processor (cleanup)
   */
  stop(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
  }
}

export const messageQueueManager = new MessageQueueManager();


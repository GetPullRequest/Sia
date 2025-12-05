import type { IncomingMessage, OutgoingMessage, MessageAttachment, MessageBlock } from './messaging-types';

/**
 * Abstract base class for platform-specific messaging adapters
 * Implementations handle platform-specific message parsing and sending
 */
export abstract class MessagingAdapter {
  abstract platform: string;
  
  /**
   * Convert platform-specific message to generic format
   */
  abstract parseIncomingMessage(rawMessage: any): Promise<IncomingMessage>;
  
  /**
   * Send message back to platform
   */
  abstract sendMessage(message: OutgoingMessage): Promise<void>;
  
  /**
   * Download and store attachments
   */
  abstract downloadAttachment(attachment: MessageAttachment): Promise<string>;
  
  /**
   * Platform-specific formatting for message blocks
   */
  abstract formatBlocks(blocks?: MessageBlock[]): any;
}

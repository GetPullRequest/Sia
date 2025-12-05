import type { IncomingMessage, OutgoingMessage, ConversationMessage } from './messaging-types';
import type { MessagingAdapter } from './messaging-adapter';
import { db, schema } from '../../db/index';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { ConversationalHandler } from './conversational-handler';
import { channelSettingsManager } from './channel-settings-manager';

/**
 * Manages conversations using unified conversational handler with function calling
 */
export class ConversationManager {
  private handler: ConversationalHandler;
  
  constructor() {
    this.handler = new ConversationalHandler();
  }
  
  /**
   * Determine response location (thread vs channel) - platform agnostic
   * Default: always reply in thread (except DMs)
   */
  private determineResponseLocation(message: IncomingMessage): { threadId?: string; createThread: boolean } {
    // DMs: no thread (platform-specific check - Slack DMs start with 'D', Discord DMs are different)
    // For now, we'll check if it's a DM based on channel type in metadata or channelId pattern
    const isDM = message.metadata.isDM === true || 
                 (message.platform === 'slack' && message.channelId.startsWith('D'));
    
    if (isDM) {
      return { createThread: false };
    }
    
    // Already in thread: continue thread
    if (message.threadId) {
      return { threadId: message.threadId, createThread: false };
    }
    
    // Channel message: always create/use thread
    // Use message timestamp/id as thread_ts to create thread
    return { threadId: message.id, createThread: true };
  }

  /**
   * Handle incoming message from any platform
   */
  async handleMessage(
    message: IncomingMessage,
    adapter: MessagingAdapter,
    orgId: string,
    logger?: any,
    isMention = false
  ): Promise<void> {
    // Set logger if provided (for request-scoped logging)
    if (logger) {
      this.handler.setLogger(logger);
    }
    try {
      // Check quiet mode
      const isQuiet = await channelSettingsManager.isQuietMode(
        message.platform,
        message.channelId,
        message.threadId,
        orgId
      );
      
      // Get conversation history
      const history = await this.getConversationHistory(
        message.platform,
        message.threadId || message.channelId,
        orgId
      );
      
      // Use unified conversational handler with function calling
      const response = await this.handler.handle(message, history, orgId, isQuiet, isMention);
      
      // If response is null, handler decided not to respond (e.g., quiet mode + low relevance)
      if (!response) {
        logger?.info({ messageId: message.id, isQuiet }, 'Handler returned null, skipping response');
        return;
      }
      
      // Handle quiet mode commands
      if (response.metadata?.quietModeCommand) {
        const quiet = response.metadata.quietModeCommand === 'enable';
        await channelSettingsManager.setQuietMode(
          message.platform,
          message.channelId,
          message.threadId,
          orgId,
          quiet
        );
        logger?.info({ quiet, channelId: message.channelId, threadId: message.threadId }, 'Quiet mode updated');
      }
      
      // Determine response location (thread vs channel)
      const location = this.determineResponseLocation(message);
      response.threadId = location.threadId || response.threadId;
      
      // Send response
      await adapter.sendMessage(response);
      
      // Store conversation
      await this.storeConversation(message, response, orgId);
    } catch (error) {
      console.error('Error handling message:', error);
      await this.handleError(message, adapter, error);
    }
  }
  
  /**
   * Get conversation history from database
   */
  private async getConversationHistory(
    platform: string,
    threadId: string,
    orgId: string
  ): Promise<ConversationMessage[]> {
    const result = await db
      .select()
      .from(schema.conversations)
      .where(
        and(
          eq(schema.conversations.platform, platform),
          eq(schema.conversations.threadId, threadId),
          eq(schema.conversations.orgId, orgId)
        )
      )
      .limit(1);
    
    if (result.length === 0) {
      return [];
    }
    
    return (result[0].messages as ConversationMessage[]) || [];
  }
  
  /**
   * Store conversation in database
   */
  private async storeConversation(
    message: IncomingMessage,
    response: OutgoingMessage,
    orgId: string
  ): Promise<void> {
    const threadId = message.threadId || message.channelId;
    
    // Get existing conversation
    const existing = await db
      .select()
      .from(schema.conversations)
      .where(
        and(
          eq(schema.conversations.platform, message.platform),
          eq(schema.conversations.threadId, threadId),
          eq(schema.conversations.orgId, orgId)
        )
      )
      .limit(1);
    
    const userMessage: ConversationMessage = {
      role: 'user',
      content: message.text,
      timestamp: message.timestamp,
    };
    
    const assistantMessage: ConversationMessage = {
      role: 'assistant',
      content: response.text,
      timestamp: new Date().toISOString(),
    };
    
    if (existing.length > 0) {
      // Update existing conversation
      const messages = (existing[0].messages as ConversationMessage[]) || [];
      messages.push(userMessage, assistantMessage);
      
      // Keep only last 20 messages
      const trimmedMessages = messages.slice(-20);
      
      await db
        .update(schema.conversations)
        .set({
          messages: trimmedMessages,
          lastMessageAt: new Date(),
        })
        .where(eq(schema.conversations.id, existing[0].id));
    } else {
      // Create new conversation
      // Use message.userId if available, otherwise fallback to 'system' for bot/system messages
      const userId = message.userId || 'system';
      
      await db.insert(schema.conversations).values({
        id: uuidv4(),
        platform: message.platform,
        channelId: message.channelId,
        threadId: threadId,
        userId: userId,
        orgId: orgId,
        messages: [userMessage, assistantMessage],
        lastMessageAt: new Date(),
      });
    }
  }
  
  /**
   * Handle errors gracefully
   */
  private async handleError(
    message: IncomingMessage,
    adapter: MessagingAdapter,
    _error: any
  ): Promise<void> {
    const response: OutgoingMessage = {
      channelId: message.channelId,
      threadId: message.threadId,
      text: "Sorry, I encountered an error processing your request. Please try again or contact support if the issue persists.",
    };
    
    await adapter.sendMessage(response);
  }
}

export const conversationManager = new ConversationManager();

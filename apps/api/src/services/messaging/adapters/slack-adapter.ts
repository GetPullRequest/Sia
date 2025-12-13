import { MessagingAdapter } from '../messaging-adapter';
import type {
  IncomingMessage,
  OutgoingMessage,
  MessageAttachment,
  MessageBlock,
} from '../messaging-types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

/**
 * Slack-specific messaging adapter
 */
export class SlackAdapter extends MessagingAdapter {
  platform = 'slack';
  private accessToken: string;

  constructor(accessToken: string) {
    super();
    this.accessToken = accessToken;
  }

  /**
   * Parse Slack event to generic message format
   */
  async parseIncomingMessage(event: any): Promise<IncomingMessage> {
    const attachments: MessageAttachment[] = [];

    // Parse file attachments
    if (event.files && Array.isArray(event.files)) {
      for (const file of event.files) {
        attachments.push({
          type: this.getFileType(file.mimetype),
          url: file.url_private,
          fileName: file.name,
          mimeType: file.mimetype,
          size: file.size,
        });
      }
    }

    // Fetch user name from Slack API if userId is available
    let userName: string | undefined;
    if (event.user) {
      try {
        const userResponse = await fetch(
          `https://slack.com/api/users.info?user=${event.user}`,
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
            },
          }
        );

        if (userResponse.ok) {
          const userData = (await userResponse.json()) as any;
          if (userData.ok && userData.user) {
            // Prefer real_name, fallback to display_name, then name
            userName =
              userData.user.real_name ||
              userData.user.profile?.real_name ||
              userData.user.profile?.display_name ||
              userData.user.name;
          }
        }
      } catch (error) {
        // Silently fail - userName will remain undefined
        console.warn('Failed to fetch Slack user info:', error);
      }
    }

    return {
      id: event.ts,
      platform: 'slack',
      channelId: event.channel,
      threadId: event.thread_ts,
      userId: event.user,
      userName,
      text: event.text || '',
      timestamp: event.ts,
      attachments,
      metadata: { event },
    };
  }

  /**
   * Send message to Slack
   * Default behavior: always reply in thread if threadId is provided
   */
  async sendMessage(message: OutgoingMessage): Promise<void> {
    // Convert markdown to Slack's mrkdwn format
    const slackText = this.convertMarkdownToSlack(message.text);

    const payload: any = {
      channel: message.channelId,
      text: slackText,
    };

    // Always set thread_ts if provided (default: reply in thread)
    // For channel messages without existing thread, threadId will be the message timestamp
    // which creates a new thread
    if (message.threadId) {
      payload.thread_ts = message.threadId;
    }

    if (message.blocks && message.blocks.length > 0) {
      payload.blocks = this.formatBlocks(message.blocks);
    }

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to send Slack message: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }
  }

  /**
   * Convert markdown formatting to Slack's mrkdwn format
   */
  private convertMarkdownToSlack(text: string): string {
    if (!text) return text;

    let converted = text;

    // Convert markdown links [text](url) to Slack format <url|text>
    // This regex handles: [text](url) and [text](url "title")
    converted = converted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>');

    // Convert **bold** to *bold* (Slack uses single asterisk for bold)
    // Do this before converting single asterisks to avoid conflicts
    converted = converted.replace(/\*\*([^*]+)\*\*/g, '*$1*');

    // Convert __bold__ to *bold* (alternative markdown bold syntax)
    converted = converted.replace(/__([^_]+)__/g, '*$1*');

    // Convert *italic* to _italic_ (Slack uses underscore for italic)
    // Only convert single asterisks that aren't part of bold markers
    // Use a more careful approach: match *text* where text doesn't contain asterisks
    converted = converted.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '_$1_');

    // Convert headers (# Header) to bold (*Header*)
    converted = converted.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');

    // Convert inline code `code` - Slack uses backticks the same way
    // This is already compatible, no conversion needed

    // Convert code blocks ```code``` to ```code``` (Slack supports this)
    // Already compatible, no conversion needed

    return converted;
  }

  /**
   * Download attachment from Slack
   */
  async downloadAttachment(attachment: MessageAttachment): Promise<string> {
    const response = await fetch(attachment.url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download attachment: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Save to temp file
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `${uuidv4()}-${attachment.fileName}`);
    fs.writeFileSync(tempFile, buffer);

    return tempFile;
  }

  /**
   * Format message blocks for Slack
   */
  formatBlocks(blocks?: MessageBlock[]): any[] {
    if (!blocks) return [];

    return blocks
      .map(block => {
        if (block.type === 'section') {
          const slackBlock: any = {
            type: 'section',
          };

          if (block.text) {
            slackBlock.text = {
              type: 'mrkdwn',
              text: block.text,
            };
          }

          if (block.fields && block.fields.length > 0) {
            slackBlock.fields = block.fields.map(field => ({
              type: 'mrkdwn',
              text: `*${field.title}*\n${field.value}`,
            }));
          }

          return slackBlock;
        }

        if (block.type === 'divider') {
          return { type: 'divider' };
        }

        if (block.type === 'context') {
          return {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: block.text || '',
              },
            ],
          };
        }

        return null;
      })
      .filter(Boolean);
  }

  private getFileType(mimeType: string): 'image' | 'video' | 'file' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return 'file';
  }
}

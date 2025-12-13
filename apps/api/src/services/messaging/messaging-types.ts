// Messaging abstraction types
export interface IncomingMessage {
  id: string;
  platform: 'slack' | 'discord' | 'linear' | 'github';
  channelId: string;
  threadId?: string;
  userId: string;
  userName?: string;
  text: string;
  timestamp: string;
  attachments?: MessageAttachment[];
  metadata: Record<string, unknown>;
}

export interface MessageAttachment {
  type: 'image' | 'video' | 'file';
  url: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  localPath?: string; // After download
}

export interface OutgoingMessage {
  channelId: string;
  threadId?: string;
  text: string;
  blocks?: MessageBlock[];
  attachments?: MessageAttachment[];
  metadata?: Record<string, unknown>;
}

export interface MessageBlock {
  type: 'section' | 'divider' | 'actions' | 'context';
  text?: string;
  fields?: Array<{ title: string; value: string }>;
  buttons?: Array<{ text: string; value: string; actionId: string }>;
}

// Intent classification
export enum IntentType {
  ADD_TASK = 'add_task',
  CHECK_STATUS = 'check_status',
  CANCEL_TASK = 'cancel_task',
  REPRIORITIZE_TASK = 'reprioritize_task',
  PAUSE_EXECUTION = 'pause_execution',
  RESUME_EXECUTION = 'resume_execution',
  LIST_PR_REVIEWS = 'list_pr_reviews',
  GENERAL_CHAT = 'general_chat',
  UNKNOWN = 'unknown',
}

export interface ClassifiedIntent {
  type: IntentType;
  confidence: number;
  entities: Record<string, any>;
  requiresConfirmation: boolean;
  missingInfo?: string[];
  clarificationQuestion?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  intent?: string;
}

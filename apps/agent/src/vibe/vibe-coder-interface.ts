import type { LogMessage } from '@sia/models';

export interface VibeCoder {
  generateCode(
    workspacePath: string,
    prompt: string,
    jobId: string
  ): AsyncGenerator<LogMessage>;
}

export interface VibeCoderConfig {
  type: 'cursor' | 'other'; // TODO: Add more types as needed
  executablePath?: string;
  // TODO: Add other configuration options
}

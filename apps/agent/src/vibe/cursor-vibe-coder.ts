import { spawn } from 'child_process';
import type { VibeCoder } from './vibe-coder-interface.js';
import type { LogMessage } from '@sia/models';

interface CursorStreamEvent {
  type: 'system' | 'assistant' | 'tool_call' | 'result';
  subtype?: string;
  model?: string;
  message?: {
    content?: Array<{ text?: string }>;
    delta?: { text?: string };
  };
  tool_call?: {
    writeToolCall?: {
      args?: {
        path?: string;
        content?: string;
      };
      result?: {
        success?: {
          linesCreated?: number;
          fileSize?: number;
          content?: string;
          files?: Array<{ content?: string }>;
        };
      };
    };
    readToolCall?: {
      args?: {
        path?: string;
        content?: string;
      };
      result?: {
        success?: {
          totalLines?: number;
          content?: string;
        };
      };
    };
  };
  duration_ms?: number;
}

interface DetailLog {
  filePath: string;
  action: 'created' | 'modified' | 'read';
  linesCreated?: number;
  linesModified?: number;
  content?: string;
  fileSize?: number;
  timestamp: string;
}

export class CursorVibeCoder implements VibeCoder {
  private executablePath: string;

  constructor(executablePath?: string) {
    this.executablePath = executablePath || 'cursor-agent';
  }

  async* generateCode(
    workspacePath: string,
    prompt: string,
    jobId: string
  ): AsyncGenerator<LogMessage> {
    let accumulatedText = '';
    let lastChunk = '';
    let toolCount = 0;
    const startTime = Date.now();
    const detailLogs: DetailLog[] = [];
    const logQueue: LogMessage[] = [];
    let processClosed = false;
    let processStderr = '';

    yield {
      level: 'info',
      message: '🚀 Starting Cursor code generation...',
      timestamp: new Date().toISOString(),
      jobId,
      stage: 'code-generation',
    };

    const process = spawn(this.executablePath, [
      '-p',
      '--force',
      '--output-format',
      'stream-json',
      '--stream-partial-output',
      prompt,
    ], {
      cwd: workspacePath,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdoutBuffer = '';

    process.stdout.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event: CursorStreamEvent = JSON.parse(line);
          const logs = this.processEvent(event, {
            accumulatedText,
            lastChunk,
            toolCount,
            startTime,
            detailLogs,
            jobId,
          });
          
          // Update state
          accumulatedText = logs.state.accumulatedText;
          lastChunk = logs.state.lastChunk;
          toolCount = logs.state.toolCount;
          
          // Add logs to queue
          logQueue.push(...logs.logs);
        } catch {
          // Skip invalid JSON lines
        }
      }
    });

      process.stderr.on('data', (chunk: Buffer) => {
        processStderr += chunk.toString();
      });

      process.on('error', (error) => {
        logQueue.push({
          level: 'error',
          message: `Failed to start cursor-agent: ${error.message}`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'code-generation',
        });
        processClosed = true;
      });

      process.on('close', (code) => {
        processClosed = true;

      const endTime = Date.now();
      const totalTime = Math.floor((endTime - startTime) / 1000);

      if (code !== 0 && processStderr) {
        logQueue.push({
          level: 'error',
          message: `cursor-agent exited with code ${code}: ${processStderr}`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'code-generation',
        });
      }

      logQueue.push({
        level: 'info',
        message: `🎯 Completed in ${totalTime}s. Generated ${toolCount} tools, ${accumulatedText.length} chars`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'code-generation',
      });

      // Send detail logs as JSON in message field
      if (detailLogs.length > 0) {
        logQueue.push({
          level: 'info',
          message: JSON.stringify({
            logType: 'detail',
            details: detailLogs,
          }),
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'code-generation-detail',
        });
      }
    });

    // Yield logs as they come in
    while (!processClosed || logQueue.length > 0) {
      if (logQueue.length > 0) {
        const log = logQueue.shift();
        if (log) {
          yield log;
        }
      } else {
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  private processEvent(
    event: CursorStreamEvent,
    state: {
      accumulatedText: string;
      lastChunk: string;
      toolCount: number;
      startTime: number;
      detailLogs: DetailLog[];
      jobId: string;
    }
  ): { logs: LogMessage[]; state: typeof state } {
    const logs: LogMessage[] = [];
    const newState = { ...state };

    switch (event.type) {
      case 'system':
        if (event.subtype === 'init' && event.model) {
          logs.push({
            level: 'info',
            message: `🤖 Using model: ${event.model}`,
            timestamp: new Date().toISOString(),
            jobId: state.jobId,
            stage: 'code-generation',
          });
        }
        break;

      case 'assistant': {
        const chunkParts: string[] = [];
        if (event.message?.content) {
          for (const content of event.message.content) {
            if (content.text) {
              chunkParts.push(content.text);
            }
          }
        }
        if (event.message?.delta?.text) {
          chunkParts.push(event.message.delta.text);
        }
        const chunk = chunkParts.filter(Boolean).join('');

        if (chunk && chunk !== newState.lastChunk) {
          if (!newState.accumulatedText.endsWith(chunk)) {
            newState.accumulatedText += chunk;
          }
          newState.lastChunk = chunk;
        }
        break;
      }

      case 'tool_call': {
        if (event.subtype === 'started') {
          newState.toolCount++;
          const writeCall = event.tool_call?.writeToolCall;
          const readCall = event.tool_call?.readToolCall;

          if (writeCall?.args?.path) {
            logs.push({
              level: 'info',
              message: `🔧 Tool ${newState.toolCount} Creating ${writeCall.args.path}`,
              timestamp: new Date().toISOString(),
              jobId: state.jobId,
              stage: 'code-generation',
            });
          } else if (readCall?.args?.path) {
            logs.push({
              level: 'info',
              message: `📖 Tool ${newState.toolCount} Reading ${readCall.args.path}`,
              timestamp: new Date().toISOString(),
              jobId: state.jobId,
              stage: 'code-generation',
            });
          } else {
            logs.push({
              level: 'info',
              message: `🧰 Tool ${newState.toolCount} started`,
              timestamp: new Date().toISOString(),
              jobId: state.jobId,
              stage: 'code-generation',
            });
          }
        } else if (event.subtype === 'completed') {
          const writeCall = event.tool_call?.writeToolCall;
          const readCall = event.tool_call?.readToolCall;

          if (writeCall?.result?.success) {
            const result = writeCall.result.success;
            const path = writeCall.args?.path || 'unknown';
            const lines = result.linesCreated || 0;
            const size = result.fileSize || 0;

            logs.push({
              level: 'info',
              message: `   ✅ Created ${lines} lines (${size} bytes)`,
              timestamp: new Date().toISOString(),
              jobId: state.jobId,
              stage: 'code-generation',
            });

            const code = [
              writeCall.args?.content,
              result.content,
              ...(result.files?.map(f => f.content).filter(Boolean) || []),
            ]
              .filter(Boolean)
              .join('\n\n');

            if (code && !newState.accumulatedText.includes(code)) {
              newState.accumulatedText += code;
            }

            newState.detailLogs.push({
              filePath: path,
              action: 'created',
              linesCreated: lines,
              content: code || undefined,
              fileSize: size,
              timestamp: new Date().toISOString(),
            });
          } else if (readCall?.result?.success) {
            const result = readCall.result.success;
            const path = readCall.args?.path || 'unknown';
            const lines = result.totalLines || 0;

            logs.push({
              level: 'info',
              message: `   ✅ Read ${lines} lines`,
              timestamp: new Date().toISOString(),
              jobId: state.jobId,
              stage: 'code-generation',
            });

            const code = [
              readCall.args?.content,
              result.content,
            ]
              .filter(Boolean)
              .join('\n\n');

            if (code && !newState.accumulatedText.includes(code)) {
              newState.accumulatedText += code;
            }

            newState.detailLogs.push({
              filePath: path,
              action: 'read',
              linesCreated: lines,
              content: code || undefined,
              timestamp: new Date().toISOString(),
            });
          } else {
            logs.push({
              level: 'info',
              message: '   ✅ Tool completed',
              timestamp: new Date().toISOString(),
              jobId: state.jobId,
              stage: 'code-generation',
            });
          }
        }
        break;
      }

      case 'result': {
        const duration = event.duration_ms || 0;
        const endTime = Date.now();
        const totalTime = Math.floor((endTime - state.startTime) / 1000);

        logs.push({
          level: 'info',
          message: `🎯 Completed in ${duration}ms (${totalTime}s total)`,
          timestamp: new Date().toISOString(),
          jobId: state.jobId,
          stage: 'code-generation',
        });

        logs.push({
          level: 'info',
          message: `📊 Final stats: ${newState.toolCount} tools, ${newState.accumulatedText.length} chars generated`,
          timestamp: new Date().toISOString(),
          jobId: state.jobId,
          stage: 'code-generation',
        });
        break;
      }
    }

    return { logs, state: newState };
  }
}

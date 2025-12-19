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

  async *generateCode(
    workspacePath: string,
    prompt: string,
    jobId: string,
    credentials?: Record<string, string>
  ): AsyncGenerator<LogMessage> {
    try {
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

      // Prepare environment for cursor-agent
      // Priority: explicit API key > user's environment (for local dev)
      const cursorEnv: NodeJS.ProcessEnv = {
        ...process.env, // Base environment
      };

      // If credentials contain vibe agent API key, use it for cursor-agent
      if (credentials?.vibeApiKey) {
        cursorEnv.CURSOR_API_KEY = credentials.vibeApiKey;
        yield {
          level: 'info',
          message: 'Using provided API key for authentication',
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'code-generation',
        };
      } else {
        yield {
          level: 'info',
          message: 'No API key provided, using user session authentication',
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'code-generation',
        };
      }

      yield {
        level: 'info',
        message: `Spawning process: ${this.executablePath} in ${workspacePath}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'code-generation',
      };

      const childProcess = spawn(
        this.executablePath,
        [
          '-p',
          '--force',
          '--output-format',
          'stream-json',
          '--stream-partial-output',
          prompt,
        ],
        {
          cwd: workspacePath,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: cursorEnv,
        }
      );

      // Close stdin immediately to prevent cursor-agent from blocking on input
      // cursor-agent should run non-interactively with -p flag, but closing stdin
      // ensures it can't hang waiting for user input
      childProcess.stdin?.end();

      yield {
        level: 'info',
        message: `Process spawned with PID: ${childProcess.pid}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'code-generation',
      };

      let stdoutBuffer = '';
      let hasReceivedOutput = false;

      // Timeout if no output received within 30 seconds (likely auth failure)
      const startupTimeout = setTimeout(() => {
        if (!hasReceivedOutput && !processClosed) {
          logQueue.push({
            level: 'error',
            message: `cursor-agent startup timeout: No output received within 30 seconds. This usually means authentication failed. Check if you're logged in to cursor-agent or provide an API key.`,
            timestamp: new Date().toISOString(),
            jobId,
            stage: 'code-generation',
          });
          childProcess.kill('SIGTERM');
          processClosed = true;
        }
      }, 30000);

      childProcess.stdout.on('data', (chunk: Buffer) => {
        hasReceivedOutput = true;
        clearTimeout(startupTimeout); // Clear timeout once we get output
        const chunkStr = chunk.toString();
        stdoutBuffer += chunkStr;
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
            // Only log non-JSON if it looks important (not empty/whitespace)
            if (line.trim().length > 0) {
              logQueue.push({
                level: 'debug',
                message: `Non-JSON output: ${line.substring(0, 200)}`,
                timestamp: new Date().toISOString(),
                jobId,
                stage: 'code-generation',
              });
            }
          }
        }
      });

      childProcess.stderr.on('data', (chunk: Buffer) => {
        const stderrChunk = chunk.toString();
        processStderr += stderrChunk;

        // Check for authentication-related errors
        const authErrors = [
          'authentication failed',
          'api key',
          'not logged in',
          'unauthorized',
          'invalid credentials',
        ];

        const isAuthError = authErrors.some(err =>
          stderrChunk.toLowerCase().includes(err)
        );

        // Log stderr immediately for visibility
        logQueue.push({
          level: isAuthError ? 'error' : 'warning',
          message: isAuthError
            ? `Authentication error: ${stderrChunk}`
            : `stderr: ${stderrChunk}`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'code-generation',
        });

        // Kill process immediately on auth errors
        if (isAuthError) {
          logQueue.push({
            level: 'error',
            message:
              'cursor-agent authentication failed. Please login to cursor-agent or provide an API key.',
            timestamp: new Date().toISOString(),
            jobId,
            stage: 'code-generation',
          });
          childProcess.kill('SIGTERM');
        }
      });

      childProcess.on('error', error => {
        clearTimeout(startupTimeout);
        logQueue.push({
          level: 'error',
          message: `Failed to start cursor-agent: ${error.message}`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'code-generation',
        });
        processClosed = true;
      });

      childProcess.on('close', code => {
        clearTimeout(startupTimeout);
        processClosed = true;

        const endTime = Date.now();
        const totalTime = Math.floor((endTime - startTime) / 1000);

        logQueue.push({
          level: 'info',
          message: `Process closed with exit code: ${code}`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'code-generation',
        });

        if (code !== 0 && processStderr) {
          logQueue.push({
            level: 'error',
            message: `cursor-agent exited with code ${code}: ${processStderr}`,
            timestamp: new Date().toISOString(),
            jobId,
            stage: 'code-generation',
          });
        }

        // Summary of what was done
        const filesCreated = detailLogs.filter(
          l => l.action === 'created'
        ).length;
        const filesRead = detailLogs.filter(l => l.action === 'read').length;
        const totalLines = detailLogs.reduce(
          (sum, l) => sum + (l.linesCreated || 0),
          0
        );

        logQueue.push({
          level: 'info',
          message: `✅ Completed in ${totalTime}s | Files: ${filesCreated} created, ${filesRead} read | Total: ${totalLines} lines`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'code-generation',
        });
      });

      // Yield logs as they come in
      yield {
        level: 'info',
        message: `Starting log streaming loop. Queue length: ${logQueue.length}, Process closed: ${processClosed}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'code-generation',
      };

      let iterationCount = 0;
      const maxIterations = 36000; // 10 minutes max (36000 * 10ms = 360s)

      while (!processClosed || logQueue.length > 0) {
        if (logQueue.length > 0) {
          const log = logQueue.shift();
          if (log) {
            yield log;
          }
        } else {
          // Wait a bit before checking again
          await new Promise(resolve => setTimeout(resolve, 10));
          iterationCount++;

          // Log a heartbeat every 30 seconds
          if (iterationCount % 3000 === 0) {
            yield {
              level: 'info',
              message: `Waiting for process to complete... (${Math.floor(
                iterationCount / 100
              )}s elapsed)`,
              timestamp: new Date().toISOString(),
              jobId,
              stage: 'code-generation',
            };
          }

          // Timeout after max iterations
          if (iterationCount >= maxIterations) {
            yield {
              level: 'error',
              message: `Code generation timed out after ${Math.floor(
                maxIterations / 100
              )}s. Process may be hung.`,
              timestamp: new Date().toISOString(),
              jobId,
              stage: 'code-generation',
            };
            break;
          }
        }
      }

      yield {
        level: 'info',
        message: `Finished log streaming. Process closed: ${processClosed}, Queue length: ${logQueue.length}`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'code-generation',
      };
    } catch (error) {
      yield {
        level: 'error',
        message: `Code generation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'code-generation',
      };
      throw error;
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

            const code = [
              writeCall.args?.content,
              result.content,
              ...(result.files?.map(f => f.content).filter(Boolean) || []),
            ]
              .filter(Boolean)
              .join('\n\n');

            // Show file path and a preview of the content
            const preview =
              code.length > 100 ? code.substring(0, 100) + '...' : code;
            const previewLines = preview.split('\n').slice(0, 3).join('\n');

            logs.push({
              level: 'info',
              message: `   ✅ Created ${path} (${lines} lines, ${size} bytes)\n      Preview: ${previewLines}`,
              timestamp: new Date().toISOString(),
              jobId: state.jobId,
              stage: 'code-generation',
            });

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
              message: `   ✅ Read ${path} (${lines} lines)`,
              timestamp: new Date().toISOString(),
              jobId: state.jobId,
              stage: 'code-generation',
            });

            const code = [readCall.args?.content, result.content]
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

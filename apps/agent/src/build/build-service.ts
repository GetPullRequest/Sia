import { execa } from 'execa';
import type { LogMessage } from '@sia/models';

export interface BuildResult {
  success: boolean;
  errors?: string[];
  output?: string;
}

export class BuildService {
  private workspacePath: string;
  private timeoutMs: number;

  constructor(workspacePath: string, timeoutMs: number = 20 * 60 * 1000) {
    this.workspacePath = workspacePath;
    this.timeoutMs = timeoutMs;
  }

  async *build(
    buildCommands: string[],
    jobId: string
  ): AsyncGenerator<LogMessage> {
    try {
      yield {
        level: 'info',
        message: 'Starting build process',
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'build',
      };

      for (const command of buildCommands) {
        yield {
          level: 'info',
          message: `Executing: ${command}`,
          timestamp: new Date().toISOString(),
          jobId,
          stage: 'build',
        };

        try {
          // Use shell: true to resolve npm/node executables from PATH
          // This prevents ENOENT errors when npm/node are not in the direct PATH
          const subprocess = execa(command, {
            cwd: this.workspacePath,
            all: true, // Combine stdout and stderr for streaming
            shell: true, // Execute through shell to resolve npm, node, etc.
          });

          // Timeout configuration
          const startTime = Date.now();
          let lastOutputTime = Date.now();
          let hasTimedOut = false;

          // Start a timeout checker interval
          const timeoutChecker = setInterval(() => {
            const now = Date.now();
            const timeSinceLastOutput = now - lastOutputTime;
            const totalRuntime = now - startTime;

            // Check if no output for configured timeout
            if (timeSinceLastOutput > this.timeoutMs) {
              hasTimedOut = true;
              clearInterval(timeoutChecker);
              subprocess.kill('SIGTERM');
              console.error(
                `Build command timed out: no output for ${Math.floor(
                  timeSinceLastOutput / 60000
                )} minutes`
              );
            }
            // Check if total runtime exceeds configured timeout
            else if (totalRuntime > this.timeoutMs) {
              hasTimedOut = true;
              clearInterval(timeoutChecker);
              subprocess.kill('SIGTERM');
              console.error(
                `Build command timed out: total runtime exceeded ${Math.floor(
                  this.timeoutMs / 60000
                )} minutes`
              );
            }
          }, 5000); // Check every 5 seconds

          // Stream combined output (stdout + stderr) in real-time
          if (subprocess.all) {
            for await (const chunk of subprocess.all) {
              lastOutputTime = Date.now(); // Update last output time
              const output = chunk.toString();
              if (output.trim()) {
                yield {
                  level: 'info',
                  message: output,
                  timestamp: new Date().toISOString(),
                  jobId,
                  stage: 'build',
                };
              }
            }
          }

          // Clear the timeout checker
          clearInterval(timeoutChecker);

          // Check if timed out
          if (hasTimedOut) {
            const timeSinceLastOutput = Date.now() - lastOutputTime;
            const totalRuntime = Date.now() - startTime;

            let timeoutReason = '';
            if (timeSinceLastOutput > this.timeoutMs) {
              timeoutReason = `Command timed out after ${Math.floor(
                timeSinceLastOutput / 60000
              )} minutes without output`;
            } else {
              timeoutReason = `Command timed out after ${Math.floor(
                totalRuntime / 60000
              )} minutes of execution`;
            }

            yield {
              level: 'error',
              message: `Build command terminated: ${command}\n${timeoutReason}. Build commands should complete within ${Math.floor(
                this.timeoutMs / 60000
              )} minutes or provide regular output.`,
              timestamp: new Date().toISOString(),
              jobId,
              stage: 'build',
            };

            throw new Error(
              `Build timed out: ${timeoutReason}. Commands taking longer than ${Math.floor(
                this.timeoutMs / 60000
              )} minutes without output are automatically terminated.`
            );
          }

          // Wait for the command to complete
          await subprocess;

          yield {
            level: 'success',
            message: `Successfully executed: ${command}`,
            timestamp: new Date().toISOString(),
            jobId,
            stage: 'build',
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          const stderr = (error as any)?.stderr || '';
          const stdout = (error as any)?.stdout || '';

          // Don't duplicate timeout error messages
          if (!errorMessage.includes('Build timed out')) {
            yield {
              level: 'error',
              message: `Build command failed: ${command}\n${errorMessage}\n${stderr}\n${stdout}`,
              timestamp: new Date().toISOString(),
              jobId,
              stage: 'build',
            };
          }

          throw new Error(`Build failed: ${errorMessage}`);
        }
      }

      yield {
        level: 'success',
        message: 'Build completed successfully',
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'build',
      };
    } catch (error) {
      yield {
        level: 'error',
        message: `Build process failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'build',
      };
      throw error;
    }
  }

  async executeBuild(
    buildCommands: string[] = ['npm install', 'npm run build']
  ): Promise<BuildResult> {
    const errors: string[] = [];
    let output = '';

    for (const command of buildCommands) {
      const [cmd, ...args] = command.split(' ');

      try {
        const result = await execa(cmd, args, {
          cwd: this.workspacePath,
          stdio: 'pipe',
        });

        output += result.stdout || '';
        if (result.stderr) {
          output += result.stderr;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        const stderr = (error as any)?.stderr || '';
        errors.push(`${command}: ${errorMessage}\n${stderr}`);
      }
    }

    return {
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      output,
    };
  }
}

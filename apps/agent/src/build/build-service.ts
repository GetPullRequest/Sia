import { execa } from 'execa';
import type { LogMessage } from '@sia/models';

export interface BuildResult {
  success: boolean;
  errors?: string[];
  output?: string;
}

export class BuildService {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  async* build(
    buildCommands: string[] = ['npm install', 'npm run build'],
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

        const [cmd, ...args] = command.split(' ');
        
        try {
          const result = await execa(cmd, args, {
            cwd: this.workspacePath,
            stdio: 'pipe',
          });

          // Stream output
          if (result.stdout) {
            yield {
              level: 'info',
              message: result.stdout,
              timestamp: new Date().toISOString(),
              jobId,
              stage: 'build',
            };
          }

          if (result.stderr) {
            yield {
              level: 'warning',
              message: result.stderr,
              timestamp: new Date().toISOString(),
              jobId,
              stage: 'build',
            };
          }

          yield {
            level: 'success',
            message: `Successfully executed: ${command}`,
            timestamp: new Date().toISOString(),
            jobId,
            stage: 'build',
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const stderr = (error as any)?.stderr || '';
          const stdout = (error as any)?.stdout || '';

          yield {
            level: 'error',
            message: `Build command failed: ${command}\n${errorMessage}\n${stderr}\n${stdout}`,
            timestamp: new Date().toISOString(),
            jobId,
            stage: 'build',
          };

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
        message: `Build process failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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



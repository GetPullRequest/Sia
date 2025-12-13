import Docker from 'dockerode';
import type { LogMessage } from '@sia/models';
import { Readable } from 'stream';

export interface ContainerConfig {
  image: string;
  containerName: string;
  workspaceDir: string;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export class ContainerManager {
  private docker: Docker;
  private config: ContainerConfig;
  private containerId?: string;

  constructor(config?: Partial<ContainerConfig>) {
    this.docker = new Docker();
    this.config = {
      image: config?.image || 'sia-dev-env:latest',
      containerName: config?.containerName || 'sia-dev-env',
      workspaceDir: config?.workspaceDir || '/workspace',
    };
  }

  /**
   * Ensure the dev container is running. Starts it if not running.
   */
  async ensureContainerRunning(): Promise<void> {
    try {
      // Check if container already exists
      const containers = await this.docker.listContainers({ all: true });
      const existingContainer = containers.find(c =>
        c.Names.includes(`/${this.config.containerName}`)
      );

      if (existingContainer) {
        this.containerId = existingContainer.Id;
        const container = this.docker.getContainer(this.containerId);
        const info = await container.inspect();

        if (info.State.Running) {
          console.log(
            `Container ${this.config.containerName} is already running`
          );
          return;
        } else {
          console.log(
            `Starting existing container ${this.config.containerName}...`
          );
          await container.start();
          return;
        }
      }

      // Container doesn't exist, create and start it
      console.log(`Creating new container ${this.config.containerName}...`);
      await this.createAndStartContainer();
    } catch (error) {
      throw new Error(
        `Failed to ensure container running: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Create and start a new container
   */
  private async createAndStartContainer(): Promise<void> {
    try {
      // Check if image exists, pull if not
      try {
        await this.docker.getImage(this.config.image).inspect();
      } catch {
        console.log(`Image ${this.config.image} not found, pulling...`);
        await this.pullImage(this.config.image);
      }

      // Create container
      const container = await this.docker.createContainer({
        Image: this.config.image,
        name: this.config.containerName,
        Tty: true,
        OpenStdin: true,
        HostConfig: {
          Binds: [
            // Mount workspace directory (create if needed)
            `${this.config.containerName}-workspace:${this.config.workspaceDir}`,
          ],
          AutoRemove: false,
        },
        WorkingDir: this.config.workspaceDir,
        Cmd: ['tail', '-f', '/dev/null'], // Keep container running
      });

      this.containerId = container.id;

      // Start container
      await container.start();
      console.log(
        `Container ${this.config.containerName} started successfully`
      );
    } catch (error) {
      throw new Error(
        `Failed to create and start container: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Pull Docker image
   */
  private async pullImage(image: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.docker.pull(image, (err: Error | null, stream: Readable) => {
        if (err) {
          reject(err);
          return;
        }

        this.docker.modem.followProgress(
          stream,
          (err: Error | null) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          },
          (event: { status?: string; progress?: string }) => {
            if (event.status) {
              console.log(`${event.status} ${event.progress || ''}`);
            }
          }
        );
      });
    });
  }

  /**
   * Execute a command in the container and return the result
   */
  async execInContainer(
    command: string | string[],
    workDir?: string
  ): Promise<ExecResult> {
    if (!this.containerId) {
      throw new Error('Container not running');
    }

    const container = this.docker.getContainer(this.containerId);

    try {
      const cmd = Array.isArray(command) ? command : ['/bin/sh', '-c', command];

      const exec = await container.exec({
        Cmd: cmd,
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: workDir || this.config.workspaceDir,
      });

      const stream = await exec.start({ Detach: false });

      // Collect output
      let stdout = '';
      let stderr = '';

      return new Promise((resolve, reject) => {
        // Docker multiplexes stdout/stderr into a single stream
        // Use demuxStream to separate them
        const stdoutStream = new Readable({
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          read() {},
        });
        const stderrStream = new Readable({
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          read() {},
        });

        stdoutStream.on('data', (chunk: Buffer) => {
          stdout += chunk.toString();
        });

        stderrStream.on('data', (chunk: Buffer) => {
          stderr += chunk.toString();
        });

        container.modem.demuxStream(stream, stdoutStream, stderrStream);

        stream.on('end', async () => {
          try {
            const inspectResult = await exec.inspect();
            resolve({
              exitCode: inspectResult.ExitCode || 0,
              stdout: stdout.trim(),
              stderr: stderr.trim(),
            });
          } catch (error) {
            reject(error);
          }
        });

        stream.on('error', reject);
      });
    } catch (error) {
      throw new Error(
        `Failed to execute command in container: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Execute a command in the container and stream output as log messages
   */
  async *execStreamInContainer(
    command: string | string[],
    workDir?: string,
    jobId?: string,
    stage = 'container'
  ): AsyncGenerator<LogMessage> {
    if (!this.containerId) {
      throw new Error('Container not running');
    }

    const container = this.docker.getContainer(this.containerId);

    try {
      const cmd = Array.isArray(command) ? command : ['/bin/sh', '-c', command];

      yield {
        level: 'info',
        message: `Executing in container: ${
          Array.isArray(command) ? command.join(' ') : command
        }`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage,
      };

      const exec = await container.exec({
        Cmd: cmd,
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: workDir || this.config.workspaceDir,
      });

      const stream = await exec.start({ Detach: false });

      // Collect and stream output
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const stdoutStream = new Readable({ read() {} });
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const stderrStream = new Readable({ read() {} });

      stdoutStream.on('data', (chunk: Buffer) => {
        const output = chunk.toString().trim();
        if (output) {
          // Don't yield here, collect for final message
        }
      });

      stderrStream.on('data', (chunk: Buffer) => {
        const output = chunk.toString().trim();
        if (output) {
          // Don't yield here, collect for final message
        }
      });

      container.modem.demuxStream(stream, stdoutStream, stderrStream);

      // Wait for completion
      await new Promise<void>((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      const inspectResult = await exec.inspect();
      const exitCode = inspectResult.ExitCode || 0;

      if (exitCode === 0) {
        yield {
          level: 'info',
          message: `Command completed successfully`,
          timestamp: new Date().toISOString(),
          jobId: jobId || 'unknown',
          stage,
        };
      } else {
        yield {
          level: 'error',
          message: `Command failed with exit code ${exitCode}`,
          timestamp: new Date().toISOString(),
          jobId: jobId || 'unknown',
          stage,
        };
        throw new Error(`Command failed with exit code ${exitCode}`);
      }
    } catch (error) {
      yield {
        level: 'error',
        message: `Failed to execute command: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp: new Date().toISOString(),
        jobId: jobId || 'unknown',
        stage,
      };
      throw error;
    }
  }

  /**
   * Stop the container
   */
  async stopContainer(): Promise<void> {
    if (!this.containerId) {
      console.log('Container not running, nothing to stop');
      return;
    }

    try {
      const container = this.docker.getContainer(this.containerId);
      await container.stop();
      console.log(`Container ${this.config.containerName} stopped`);
      this.containerId = undefined;
    } catch (error) {
      throw new Error(
        `Failed to stop container: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Get container status
   */
  async getContainerStatus(): Promise<{
    running: boolean;
    id?: string;
    created?: string;
  }> {
    try {
      const containers = await this.docker.listContainers({ all: true });
      const container = containers.find(c =>
        c.Names.includes(`/${this.config.containerName}`)
      );

      if (container) {
        return {
          running: container.State === 'running',
          id: container.Id,
          created: new Date(container.Created * 1000).toISOString(),
        };
      }

      return { running: false };
    } catch (error) {
      throw new Error(
        `Failed to get container status: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Remove container (cleanup)
   */
  async removeContainer(): Promise<void> {
    if (!this.containerId) {
      return;
    }

    try {
      const container = this.docker.getContainer(this.containerId);
      await container.remove({ force: true });
      console.log(`Container ${this.config.containerName} removed`);
      this.containerId = undefined;
    } catch (error) {
      throw new Error(
        `Failed to remove container: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
}

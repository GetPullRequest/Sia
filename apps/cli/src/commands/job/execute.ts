import { Command, Args, Flags } from '@oclif/core';
import { AgentClient } from '../../client.js';

export default class JobExecute extends Command {
  static override description = 'Execute a job and stream progress logs';

  static override examples = [
    '<%= config.bin %> <%= command.id %> <job-id> --prompt "Create a button component" --repo-id repo123',
  ];

  static override args = {
    'job-id': Args.string({
      description: 'Job ID to execute',
      required: true,
    }),
  };

  static override flags = {
    prompt: Flags.string({
      char: 'p',
      description: 'The prompt for the job',
      required: true,
    }),
    'repo-id': Flags.string({
      char: 'r',
      description: 'Repository ID',
    }),
    'agent-address': Flags.string({
      description: 'Agent server address',
      default: 'localhost:50051',
    }),
  };

  override async run(): Promise<void> {
    const { args, flags } = await this.parse(JobExecute);

    const client = new AgentClient(flags['agent-address'] || 'localhost:50051');

    try {
      await client.executeJob({
        jobId: args['job-id'],
        prompt: flags.prompt,
        repoId: flags['repo-id'],
        onLog: log => {
          const timestamp = new Date(log.timestamp).toLocaleTimeString();
          const prefix = `[${timestamp}] [${log.level.toUpperCase()}] [${
            log.stage
          }]`;
          this.log(`${prefix} ${log.message}`);
        },
      });
      this.log('Job execution completed');
    } catch (error) {
      this.error(
        `Failed to execute job: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    } finally {
      client.close();
    }
  }
}

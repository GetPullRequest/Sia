import { Command, Args, Flags } from '@oclif/core';
import { AgentClient } from '../../client.js';

export default class JobHint extends Command {
  static override description =
    'Send a hint to an executing job to change its course';

  static override examples = [
    '<%= config.bin %> <%= command.id %> <job-id> --hint "Use TypeScript instead of JavaScript"',
  ];

  static override args = {
    'job-id': Args.string({
      description: 'Job ID to hint',
      required: true,
    }),
  };

  static override flags = {
    hint: Flags.string({
      char: 'h',
      description: 'The hint to send to the job',
      required: true,
    }),
    'agent-address': Flags.string({
      description: 'Agent server address',
      default: 'localhost:50051',
    }),
  };

  override async run(): Promise<void> {
    const { args, flags } = await this.parse(JobHint);

    const client = new AgentClient(flags['agent-address'] || 'localhost:50051');

    try {
      const result = await client.hintJob(args['job-id'], flags.hint);

      if (result.success) {
        this.log(result.message);
      } else {
        this.error(result.message);
      }
    } catch (error) {
      this.error(
        `Failed to hint job: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    } finally {
      client.close();
    }
  }
}

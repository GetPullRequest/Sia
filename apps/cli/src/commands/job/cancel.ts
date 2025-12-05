import { Command, Args, Flags } from '@oclif/core';
import { AgentClient } from '../../client.js';

export default class JobCancel extends Command {
  static override description = 'Cancel an executing job';

  static override examples = ['<%= config.bin %> <%= command.id %> <job-id>'];

  static override args = {
    'job-id': Args.string({
      description: 'Job ID to cancel',
      required: true,
    }),
  };

  static override flags = {
    'agent-address': Flags.string({
      description: 'Agent server address',
      default: 'localhost:50051',
    }),
  };

  override async run(): Promise<void> {
    const { args, flags } = await this.parse(JobCancel);

    const client = new AgentClient(flags['agent-address'] || 'localhost:50051');

    try {
      const result = await client.cancelJob(args['job-id']);
      
      if (result.success) {
        this.log(result.message);
      } else {
        this.error(result.message);
      }
    } catch (error) {
      this.error(`Failed to cancel job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      client.close();
    }
  }
}


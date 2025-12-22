import * as dotenv from 'dotenv';
import * as path from 'path';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

// Load .env from api project root FIRST before any other imports
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiRoot = path.resolve(__dirname, '..');
const envPath = path.join(apiRoot, '.env');

console.log('🔧 Initializing test script...');
console.log(`📁 Script directory: ${__dirname}`);
console.log(`📁 API root: ${apiRoot}`);
console.log(`📄 Loading .env from: ${envPath}`);

const envResult = dotenv.config({ path: envPath });
if (envResult.error) {
  console.warn(
    `⚠️  Warning: Could not load .env file: ${envResult.error.message}`
  );
  console.warn('   Continuing with environment variables from system...');
} else {
  console.log('✅ .env file loaded successfully');
}

type ActivityFunction = (...args: any[]) => Promise<any>;

interface ActivityInfo {
  name: string;
  fn: ActivityFunction;
  description: string;
  examplePayload: any;
}

function parsePayload(payloadArg: string): any {
  // Check if it's a file path
  if (existsSync(payloadArg)) {
    try {
      const content = readFileSync(payloadArg, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`❌ Error reading file "${payloadArg}":`);
      if (error instanceof Error) {
        console.error(`   ${error.message}`);
      }
      process.exit(1);
    }
  }

  // Try to parse as JSON string
  try {
    return JSON.parse(payloadArg);
  } catch (error) {
    console.error('❌ Error parsing JSON payload:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    }
    console.error(
      '\n💡 Make sure your JSON is properly formatted, or provide a file path'
    );
    process.exit(1);
  }
}

// Main execution - wrapped in async IIFE
(async () => {
  // Add a small delay to allow debugger to attach before module imports complete
  // This helps with debugging initialization issues
  if (process.env.NODE_ENV !== 'production') {
    console.log('⏳ Waiting 100ms for debugger attachment...');
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Use dynamic import AFTER .env is loaded so database connection uses the env vars
  console.log('📦 Loading activity modules...');
  const {
    sendCommandToAgent,
    getGitCredentials,
    updateJobStatus,
    getJobDetails,
    getRepoConfigs,
    preprocessActivity,
    setQueuePaused,
  } = await import('../src/temporal/activities/index.js');
  console.log('✅ Activity modules loaded');

  const activities: Record<string, ActivityInfo> = {
    sendCommandToAgent: {
      name: 'sendCommandToAgent',
      fn: sendCommandToAgent,
      description: 'Send a command to the agent via gRPC',
      examplePayload: {
        jobId: 'job-id-here',
        jobVersion: 1,
        orgId: 'org-id-here',
        command: 'startExecution',
        payload: {
          agentId: 'agent-id-here',
        },
      },
    },
    getGitCredentials: {
      name: 'getGitCredentials',
      fn: getGitCredentials,
      description: 'Get Git credentials for a job',
      examplePayload: {
        jobId: 'job-id-here',
        orgId: 'org-id-here',
        repoId: 'repo-id-here',
      },
    },
    updateJobStatus: {
      name: 'updateJobStatus',
      fn: updateJobStatus,
      description: 'Update job status in the database',
      examplePayload: {
        jobId: 'job-id-here',
        jobVersion: 1,
        orgId: 'org-id-here',
        status: 'completed',
        prLink: 'https://github.com/...',
      },
    },
    getJobDetails: {
      name: 'getJobDetails',
      fn: getJobDetails,
      description: 'Get job details including prompt and repos',
      examplePayload: {
        jobId: 'job-id-here',
        jobVersion: 1,
        orgId: 'org-id-here',
      },
    },
    getRepoConfigs: {
      name: 'getRepoConfigs',
      fn: getRepoConfigs,
      description: 'Get repository configurations',
      examplePayload: {
        repoIds: ['repo-id-1', 'repo-id-2'],
        orgId: 'org-id-here',
        jobId: 'job-id-here',
        jobVersion: 1,
      },
    },
    preprocessActivity: {
      name: 'preprocessActivity',
      fn: preprocessActivity,
      description: 'Preprocess and claim next job from queue',
      examplePayload: {
        agentId: 'agent-id-here',
      },
    },
    setQueuePaused: {
      name: 'setQueuePaused',
      fn: setQueuePaused,
      description: 'Set pause state for a queue',
      examplePayload: {
        orgId: 'org-id-here',
        queueType: 'backlog',
        isPaused: true,
      },
    },
  };

  function printUsage() {
    console.log('🧪 Temporal Activity Test Script\n');
    console.log('Usage:');
    console.log('  tsx scripts/test-activity.ts <activityName> <payload>\n');
    console.log('Arguments:');
    console.log('  activityName  - Name of the activity to test');
    console.log('  payload       - JSON payload (string or file path)\n');
    console.log('Examples:');
    console.log(
      '  tsx scripts/test-activity.ts sendCommandToAgent \'{"jobId":"123","command":"startExecution"}\''
    );
    console.log('  tsx scripts/test-activity.ts getJobDetails payload.json');
    console.log(
      '  tsx scripts/test-activity.ts preprocessActivity \'{"agentId":"agent-123"}\'\n'
    );
    console.log('Available activities:');
    for (const [key, info] of Object.entries(activities)) {
      console.log(`  ${key.padEnd(20)} - ${info.description}`);
    }
    console.log(
      '\n💡 Tip: Copy the payload from Temporal UI and paste it as a JSON string or save to a file'
    );
    console.log('\n📋 To see example payload for an activity, run:');
    console.log('  tsx scripts/test-activity.ts <activityName> --example');
  }

  async function testActivity() {
    const activityName = process.argv[2];
    const payloadArg = process.argv[3];

    if (!activityName) {
      printUsage();
      process.exit(1);
    }

    const activity = activities[activityName];
    if (!activity) {
      console.error(`❌ Error: Unknown activity "${activityName}"\n`);
      printUsage();
      process.exit(1);
    }

    // Show example payload if requested
    if (payloadArg === '--example' || payloadArg === '-e') {
      console.log(`📋 Example payload for "${activity.name}":\n`);
      console.log(JSON.stringify(activity.examplePayload, null, 2));
      console.log(
        '\n💡 Copy this payload, modify it with your actual values, and use it to test the activity'
      );
      process.exit(0);
    }

    if (!payloadArg) {
      console.error('❌ Error: Payload is required\n');
      console.error(
        `💡 Tip: Use --example to see an example payload for "${activityName}"\n`
      );
      printUsage();
      process.exit(1);
    }

    console.log('🧪 Testing Temporal Activity');
    console.log(`📋 Activity: ${activity.name}`);
    console.log(`📝 Description: ${activity.description}`);
    console.log('');

    let payload: any;
    try {
      payload = parsePayload(payloadArg);
    } catch (error) {
      process.exit(1);
    }

    console.log('📦 Payload:');
    console.log(JSON.stringify(payload, null, 2));
    console.log('');

    console.log('🚀 Executing activity...');
    console.log('');

    const startTime = Date.now();
    try {
      const result = await activity.fn(payload);
      const duration = Date.now() - startTime;

      console.log('✅ Activity completed successfully!');
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log('');

      if (result !== undefined && result !== null) {
        console.log('📊 Result:');
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('📊 Result: (no return value)');
      }
      console.log('');

      process.exit(0);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('❌ Error executing activity:');
      console.error(`⏱️  Duration: ${duration}ms`);
      console.error('');

      if (error instanceof Error) {
        console.error(`   Message: ${error.message}`);
        if (error.stack) {
          console.error(`   Stack:`);
          const stackLines = error.stack.split('\n');
          stackLines.forEach(line => {
            console.error(`   ${line}`);
          });
        }
      } else {
        console.error('   Unknown error:', error);
      }
      console.error('');

      process.exit(1);
    }
  }

  try {
    await testActivity();
  } catch (error) {
    console.error('❌ Unhandled error in testActivity:');
    console.error(error);
    process.exit(1);
  }
})();

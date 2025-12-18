import 'dotenv/config';
import { preprocessActivity } from '../src/temporal/activities/preprocess-activity.js';
import { db } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

async function testPreprocessActivity() {
  const agentId = process.argv[2];

  if (!agentId) {
    console.error('❌ Error: Please provide an agentId as an argument');
    console.log('Usage: tsx scripts/test-preprocess-activity.ts <agentId>');
    process.exit(1);
  }

  console.log('🧪 Testing preprocessActivity');
  console.log(`📋 Agent ID: ${agentId}`);
  console.log('');

  try {
    const agents = await db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.id, agentId))
      .limit(1);

    if (agents.length === 0) {
      console.error(
        `❌ Error: Agent with ID "${agentId}" not found in database`
      );
      process.exit(1);
    }

    const agent = agents[0];
    console.log('✅ Agent found:');
    console.log(`   - Name: ${agent.name}`);
    console.log(`   - Org ID: ${agent.orgId}`);
    console.log(`   - Status: ${agent.status}`);
    console.log(`   - Host: ${agent.host || agent.ip || 'N/A'}`);
    console.log(`   - Port: ${agent.port}`);
    console.log(`   - Consecutive Failures: ${agent.consecutiveFailures || 0}`);
    console.log('');

    console.log('🚀 Executing preprocessActivity...');
    console.log('');

    const startTime = Date.now();
    const result = await preprocessActivity({ agentId });
    const duration = Date.now() - startTime;

    console.log('✅ Activity completed successfully!');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log('');
    console.log('📊 Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');

    if (result.jobId) {
      console.log('🎯 Job claimed:');
      console.log(`   - Job ID: ${result.jobId}`);
      console.log(`   - Version: ${result.jobVersion}`);
      console.log(`   - Queue Type: ${result.queueType}`);
      console.log(`   - Org ID: ${result.orgId}`);
    } else {
      console.log(
        'ℹ️  No job was claimed (agent may be offline, queue paused, or no jobs available)'
      );
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error executing preprocessActivity:');
    if (error instanceof Error) {
      console.error(`   Message: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    } else {
      console.error('   Unknown error:', error);
    }
    process.exit(1);
  }
}

testPreprocessActivity();

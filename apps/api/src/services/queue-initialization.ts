import { db, schema } from '../db/index';
import { queueWorkflowService } from './queue-workflow-service';
import { eq } from 'drizzle-orm';

/**
 * Initialize queue schedules for all active agents
 * Each agent gets one schedule that monitors both queues
 *
 * Note: This is mainly for server startup to ensure existing active agents have schedules.
 * When agents are created/updated via API, schedules are created automatically.
 *
 * Race condition handling:
 * 1. Check if scheduleId exists in Temporal
 * 2. If not, create schedule in Temporal
 * 3. If creation fails due to race condition, that's fine - another instance created it
 */
export async function initializeQueueWorkflows(): Promise<void> {
  try {
    // Get all agents to show status
    const allAgents = await db.select().from(schema.agents);
    console.log(`Found ${allAgents.length} total agents in database`);

    if (allAgents.length > 0) {
      const statusCounts = allAgents.reduce((acc, agent) => {
        acc[agent.status] = (acc[agent.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(`Agent status breakdown:`, statusCounts);
    }

    // Get all active agents
    const agents = await db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.status, 'active'));

    if (agents.length === 0) {
      console.log(
        '⚠️  No active agents found, skipping schedule initialization'
      );
      console.log(
        '   To create schedules, create an agent with status="active" or update an existing agent to active'
      );
      return;
    }

    console.log(
      `📅 Initializing queue schedules for ${agents.length} active agent(s)...`
    );

    for (const agent of agents) {
      try {
        console.log(
          `   Creating schedule for agent: ${agent.id} (org: ${agent.orgId})`
        );
        await initializeScheduleForAgent(agent.id, agent.orgId);
        console.log(`   ✅ Schedule created for agent: ${agent.id}`);
      } catch (error) {
        console.error(
          `   ❌ Failed to initialize schedule for agent ${agent.id}:`,
          error
        );
        // Continue with other agents
      }
    }

    console.log(`✅ Queue schedules initialized for ${agents.length} agent(s)`);
  } catch (error) {
    console.error('❌ Failed to initialize queue schedules:', error);
    // Don't throw - server should still start even if queue initialization fails
  }
}

/**
 * Initialize schedule for a specific agent
 * Each agent has one schedule that monitors both queues
 *
 * Temporal-first approach: Create in Temporal
 * If creation fails due to race condition, that's fine - another instance created it
 */
export async function initializeScheduleForAgent(
  agentId: string,
  orgId: string
): Promise<void> {
  try {
    // Simply create the schedule - if it already exists, that's fine
    await queueWorkflowService.startQueueSchedule(agentId);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // If schedule already exists, that's fine - another instance or previous run created it
    if (
      !errorMsg.includes('already exists') &&
      !errorMsg.includes('AlreadyExists')
    ) {
      console.error(
        `   Failed to create schedule for agent ${agentId}:`,
        errorMsg
      );
      throw error;
    }
  }
}

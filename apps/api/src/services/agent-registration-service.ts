import { db, schema } from '../db/index';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import type { NewAgent } from '../db/index';
import { queueWorkflowService } from './queue-workflow-service';

function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

export interface RegisterAgentParams {
  apiKey: string;
  hostname: string;
  ipAddress: string;
  port: number;
}

export interface RegisterAgentResult {
  agentId: string;
  orgId: string;
  success: boolean;
  message: string;
}

export async function registerAgent(
  params: RegisterAgentParams
): Promise<RegisterAgentResult> {
  const { apiKey, hostname, ipAddress, port } = params;

  // Step 1: Validate API key and get orgId
  const { apiKeys } = schema;
  const keyHash = hashApiKey(apiKey);

  const [storedKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!storedKey) {
    return {
      agentId: '',
      orgId: '',
      success: false,
      message: 'Invalid API key',
    };
  }

  const orgId = storedKey.orgId;

  // Step 2: Check if agent already exists (by orgId and hostname)
  const existingAgents = await db
    .select()
    .from(schema.agents)
    .where(
      and(eq(schema.agents.orgId, orgId), eq(schema.agents.host, hostname))
    )
    .limit(1);

  const now = new Date();

  // Step 3: Update existing agent or create new one
  if (existingAgents.length > 0) {
    // Agent exists - update it with current connection info
    const agent = existingAgents[0];

    await db
      .update(schema.agents)
      .set({
        ip: ipAddress,
        port,
        status: 'active',
        consecutiveFailures: 0,
        lastActive: now,
        lastStreamConnectedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.agents.id, agent.id));

    // Ensure schedule is active when agent registers (regardless of previous status)
    // This handles cases where schedule might be paused or doesn't exist
    try {
      await queueWorkflowService.ensureScheduleActive(agent.id);
    } catch (error) {
      console.warn(
        `Failed to ensure schedule is active for agent ${agent.id} during registration:`,
        error
      );
    }

    return {
      agentId: agent.id,
      orgId,
      success: true,
      message: 'Agent updated successfully',
    };
  } else {
    // Agent doesn't exist - create new agent record
    const agentId = `agent-${uuidv4()}`;
    const newAgent: NewAgent = {
      id: agentId,
      name: hostname,
      orgId,
      status: 'active',
      host: hostname,
      ip: ipAddress,
      port,
      consecutiveFailures: 0,
      registeredAt: now,
      lastActive: now,
      lastStreamConnectedAt: now,
    };

    await db.insert(schema.agents).values(newAgent);

    // Ensure schedule is active for the new agent
    try {
      await queueWorkflowService.ensureScheduleActive(agentId);
    } catch (error) {
      console.warn(
        `Failed to ensure schedule is active for new agent ${agentId} during registration:`,
        error
      );
    }

    return {
      agentId,
      orgId,
      success: true,
      message: 'Agent registered successfully',
    };
  }
}

import { db, schema } from '../../db/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { logStorage } from '../../services/log-storage.js';
import { websocketManager } from '../../services/websocket-manager.js';
import type { LogMessage } from '@sia/models/proto';

export async function logToJobActivity(params: {
  jobId: string;
  orgId: string;
  level: 'info' | 'error' | 'warn' | 'debug';
  message: string;
  stage?: string;
}): Promise<void> {
  const { jobId, orgId, level, message, stage } = params;

  // Get job version
  const jobResult = await db
    .select({ version: schema.jobs.version })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.orgId, orgId)))
    .orderBy(desc(schema.jobs.version))
    .limit(1);

  if (!jobResult[0]) {
    console.error(`Job not found for logging: ${jobId}`);
    return;
  }

  const version = jobResult[0].version;

  const log: LogMessage = {
    level,
    message,
    timestamp: new Date().toISOString(),
    jobId,
    stage: stage || 'workflow',
  };

  // Store log
  await logStorage.addLog(jobId, version, orgId, log);

  // Broadcast to websocket subscribers
  if (websocketManager.hasSubscribers(jobId)) {
    websocketManager.broadcast(jobId, {
      type: 'log',
      data: log,
    });
  }
}

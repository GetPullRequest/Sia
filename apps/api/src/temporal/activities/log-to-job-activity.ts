import { logStorage } from '../../services/log-storage.js';
import { websocketManager } from '../../services/websocket-manager.js';
import type { LogMessage } from '@sia/models/proto';

export async function logToJobActivity(params: {
  jobId: string;
  jobVersion: number;
  orgId: string;
  level: 'info' | 'error' | 'warn' | 'debug';
  message: string;
  stage?: string;
}): Promise<void> {
  const { jobId, jobVersion, orgId, level, message, stage } = params;

  const log: LogMessage = {
    level,
    message,
    timestamp: new Date().toISOString(),
    jobId,
    stage: stage || 'workflow',
  };

  // Store log
  await logStorage.addLog(jobId, jobVersion, orgId, log);

  // Broadcast to websocket subscribers
  if (websocketManager.hasSubscribers(jobId)) {
    websocketManager.broadcast(jobId, {
      type: 'log',
      data: log,
    });
  }
}

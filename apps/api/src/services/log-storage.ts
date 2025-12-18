import { db, schema } from '../db/index.js';
import { eq, and, desc } from 'drizzle-orm';
import type { LogMessage } from '@sia/models/proto';
import { websocketManager } from './websocket-manager.js';
import type { LogEntry } from '../db/schema.js';

interface BufferedLog {
  jobId: string;
  version: number;
  orgId: string;
  log: LogMessage;
}

// Map agent stages to our two-stage system
// Code generation includes: clone, checkout, setup, code-generation, verification-initiated, verification-completed, cleanup
// Verification includes: running tests (build, verification)
function getLogStage(
  agentStage: string | undefined
): 'code-generation' | 'verification' {
  if (!agentStage) {
    return 'code-generation';
  }

  const stage = agentStage.toLowerCase();

  // Verification stages
  if (stage === 'build' || stage === 'verification' || stage.includes('test')) {
    return 'verification';
  }

  // Everything else goes to code generation
  // Includes: clone, checkout, git, setup, code-generation, update-status, error, completed, cancelled, etc.
  return 'code-generation';
}

export class LogStorageService {
  private buffer: Map<string, BufferedLog[]> = new Map();
  private flushTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly BATCH_SIZE = 50;
  private readonly FLUSH_INTERVAL_MS = 5000;
  private readonly MAX_LOG_ENTRIES = 1000; // Max number of log entries per log type

  async addLog(
    jobId: string,
    version: number,
    orgId: string,
    log: LogMessage
  ): Promise<void> {
    const key = `${jobId}:${version}`;

    // Immediately broadcast to websocket subscribers for real-time streaming
    // This ensures logs appear instantly in the UI without waiting for buffer flush
    if (websocketManager.hasSubscribers(jobId)) {
      websocketManager.broadcast(jobId, {
        type: 'log',
        data: log,
      });
    }

    if (!this.buffer.has(key)) {
      this.buffer.set(key, []);
    }

    this.buffer.get(key)!.push({ jobId, version, orgId, log });

    if (this.buffer.get(key)!.length >= this.BATCH_SIZE) {
      await this.flush(key);
    } else {
      this.scheduleFlush(key);
    }
  }

  private scheduleFlush(key: string): void {
    if (this.flushTimers.has(key)) {
      clearTimeout(this.flushTimers.get(key)!);
    }

    const timer = setTimeout(async () => {
      await this.flush(key);
    }, this.FLUSH_INTERVAL_MS);

    this.flushTimers.set(key, timer);
  }

  private convertToLogEntry(log: LogMessage): LogEntry {
    const timestamp = log.timestamp || new Date().toISOString();
    const level = (log.level || 'info').toLowerCase() as LogEntry['level'];

    // Normalize level to match allowed values
    let normalizedLevel: LogEntry['level'] = 'info';
    if (
      level === 'debug' ||
      level === 'info' ||
      level === 'warning' ||
      level === 'error' ||
      level === 'fatal'
    ) {
      normalizedLevel = level;
    } else if (level === 'warn') {
      normalizedLevel = 'warning';
    } else if (level === 'err') {
      normalizedLevel = 'error';
    }

    const message = log.message || '';

    return {
      level: normalizedLevel,
      timestamp,
      message,
      stage: log.stage, // Store stage separately, don't prefix message
    };
  }

  private truncateLogEntries(logs: LogEntry[], maxEntries: number): LogEntry[] {
    if (logs.length <= maxEntries) {
      return logs;
    }
    // Keep the most recent logs (from the end)
    return logs.slice(-maxEntries);
  }

  private async flush(key: string): Promise<void> {
    const logs = this.buffer.get(key);
    if (!logs || logs.length === 0) {
      return;
    }

    this.buffer.set(key, []);

    if (this.flushTimers.has(key)) {
      clearTimeout(this.flushTimers.get(key)!);
      this.flushTimers.delete(key);
    }

    try {
      const [jobId, versionStr] = key.split(':');
      const version = parseInt(versionStr, 10);
      const orgId = logs[0]?.orgId;

      if (!orgId) {
        console.error(`No orgId found for logs with key ${key}`);
        return;
      }

      // Get current job to read existing logs
      const jobResult = await db
        .select({
          codeGenerationLogs: schema.jobs.codeGenerationLogs,
          codeVerificationLogs: schema.jobs.codeVerificationLogs,
        })
        .from(schema.jobs)
        .where(
          and(
            eq(schema.jobs.id, jobId),
            eq(schema.jobs.version, version),
            eq(schema.jobs.orgId, orgId)
          )
        )
        .orderBy(desc(schema.jobs.version))
        .limit(1);

      if (!jobResult[0]) {
        console.error(`Job not found for key ${key}`);
        return;
      }

      // Get existing logs (ensure they're arrays)
      const existingGenLogs: LogEntry[] = Array.isArray(
        jobResult[0].codeGenerationLogs
      )
        ? jobResult[0].codeGenerationLogs
        : [];
      const existingVerLogs: LogEntry[] = Array.isArray(
        jobResult[0].codeVerificationLogs
      )
        ? jobResult[0].codeVerificationLogs
        : [];

      // Separate logs by stage (code-generation or verification) and convert to LogEntry format
      const generationLogEntries: LogEntry[] = [];
      const verificationLogEntries: LogEntry[] = [];

      for (const { log } of logs) {
        const logEntry = this.convertToLogEntry(log);
        const stage = getLogStage(log.stage);

        if (stage === 'verification') {
          verificationLogEntries.push(logEntry);
        } else {
          generationLogEntries.push(logEntry);
        }
      }

      // Append new logs and truncate
      const newGenLogs = this.truncateLogEntries(
        [...existingGenLogs, ...generationLogEntries],
        this.MAX_LOG_ENTRIES
      );
      const newVerLogs = this.truncateLogEntries(
        [...existingVerLogs, ...verificationLogEntries],
        this.MAX_LOG_ENTRIES
      );

      // Update job with appended logs
      await db
        .update(schema.jobs)
        .set({
          codeGenerationLogs: newGenLogs.length > 0 ? newGenLogs : null,
          codeVerificationLogs: newVerLogs.length > 0 ? newVerLogs : null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.jobs.id, jobId),
            eq(schema.jobs.version, version),
            eq(schema.jobs.orgId, orgId)
          )
        );

      // Broadcast full log updates for code generation logs view
      // Note: Individual logs are already broadcast immediately in addLog() for real-time streaming
      if (websocketManager.hasSubscribers(jobId)) {
        websocketManager.broadcast(jobId, {
          type: 'logs-updated',
          data: {
            codeGenerationLogs: newGenLogs.length > 0 ? newGenLogs : null,
            codeVerificationLogs: newVerLogs.length > 0 ? newVerLogs : null,
          },
        });
      }
    } catch (error) {
      console.error(`Failed to flush logs for ${key}:`, error);
    }
  }

  async flushAll(): Promise<void> {
    const keys = Array.from(this.buffer.keys());
    await Promise.all(keys.map(key => this.flush(key)));
  }
}

export const logStorage = new LogStorageService();

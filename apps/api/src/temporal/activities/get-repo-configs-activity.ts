import { repoConfigService } from '../../services/repo-config.service.js';
import { db, schema } from '../../db/index.js';
import { inArray } from 'drizzle-orm';
import { logStorage } from '../../services/log-storage.js';
import { websocketManager } from '../../services/websocket-manager.js';

export interface GetRepoConfigsParams {
  repoIds: string[];
  orgId: string;
  jobId: string;
  jobVersion: number;
}

export interface RepoConfigResult {
  repoId: string;
  name?: string; // Repository name from repos table
  url?: string;
  setupCommands?: string[];
  buildCommands?: string[];
  testCommands?: string[];
  isConfirmed: boolean;
  detectedFrom?: string;
  inferenceSource?: string;
  inferenceConfidence?: string;
}

/**
 * Fetch repository configurations for the given repo IDs
 * Returns configs with confirmation status and detected commands, including repo URLs
 * Note: Returns plain object instead of Map for Temporal workflow compatibility
 */
export async function getRepoConfigs(
  params: GetRepoConfigsParams
): Promise<Record<string, RepoConfigResult>> {
  const { repoIds, jobId, jobVersion, orgId } = params;

  if (!repoIds || repoIds.length === 0) {
    return {};
  }

  // Log fetching repository configs
  const fetchLog = {
    level: 'info' as const,
    message: `Fetching configurations for ${repoIds.length} repository(ies)`,
    timestamp: new Date().toISOString(),
    jobId,
    stage: 'workflow',
  };
  await logStorage.addLog(jobId, jobVersion, orgId, fetchLog);
  if (websocketManager.hasSubscribers(jobId)) {
    websocketManager.broadcast(jobId, { type: 'log', data: fetchLog });
  }

  // Fetch all configs for the repos
  const configsMap = await repoConfigService.getConfigsForRepos(repoIds);

  // Fetch repo URLs from repos table
  const reposList = await db
    .select({
      id: schema.repos.id,
      url: schema.repos.url,
      name: schema.repos.name,
    })
    .from(schema.repos)
    .where(inArray(schema.repos.id, repoIds));

  const reposMap = new Map<string, { url: string; name: string }>();
  for (const repo of reposList) {
    reposMap.set(repo.id, { url: repo.url, name: repo.name });
  }

  // Transform to result format - use plain object for Temporal compatibility
  const result: Record<string, RepoConfigResult> = {};

  for (const repoId of repoIds) {
    const config = configsMap.get(repoId);
    const repo = reposMap.get(repoId);

    if (config) {
      result[repoId] = {
        repoId: config.repoId,
        name: repo?.name,
        url: repo?.url,
        setupCommands: config.setupCommands || undefined,
        buildCommands: config.buildCommands || undefined,
        testCommands: config.testCommands || undefined,
        isConfirmed: config.isConfirmed || false,
        detectedFrom: config.detectedFrom || undefined,
        inferenceSource: config.inferenceSource || undefined,
        inferenceConfidence: config.inferenceConfidence || undefined,
      };

      // Log config status for this repo
      const statusLog = {
        level: 'info' as const,
        message: `${
          config.isConfirmed ? '✓ Confirmed' : '⚠ Unconfirmed'
        } config for ${repo?.name || repoId}${
          config.detectedFrom ? ` (from ${config.detectedFrom})` : ''
        }`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'workflow',
      };
      await logStorage.addLog(jobId, jobVersion, orgId, statusLog);
      if (websocketManager.hasSubscribers(jobId)) {
        websocketManager.broadcast(jobId, { type: 'log', data: statusLog });
      }
    } else {
      // No config found - will trigger runtime detection
      result[repoId] = {
        repoId,
        name: repo?.name,
        url: repo?.url,
        isConfirmed: false,
      };

      // Log warning for missing config
      const warnLog = {
        level: 'warn' as const,
        message: `No configuration found for ${
          repo?.name || repoId
        } - will attempt runtime detection`,
        timestamp: new Date().toISOString(),
        jobId,
        stage: 'workflow',
      };
      await logStorage.addLog(jobId, jobVersion, orgId, warnLog);
      if (websocketManager.hasSubscribers(jobId)) {
        websocketManager.broadcast(jobId, { type: 'log', data: warnLog });
      }
    }
  }

  return result;
}

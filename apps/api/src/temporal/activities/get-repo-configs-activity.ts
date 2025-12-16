import { repoConfigService } from '../../services/repo-config.service.js';
import { db, schema } from '../../db/index.js';
import { inArray } from 'drizzle-orm';

export interface GetRepoConfigsParams {
  repoIds: string[];
  orgId: string;
}

export interface RepoConfigResult {
  repoId: string;
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
 */
export async function getRepoConfigs(
  params: GetRepoConfigsParams
): Promise<Map<string, RepoConfigResult>> {
  const { repoIds } = params;

  if (!repoIds || repoIds.length === 0) {
    return new Map();
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

  // Transform to result format
  const result = new Map<string, RepoConfigResult>();

  for (const repoId of repoIds) {
    const config = configsMap.get(repoId);
    const repo = reposMap.get(repoId);

    if (config) {
      result.set(repoId, {
        repoId: config.repoId,
        url: repo?.url,
        setupCommands: config.setupCommands || undefined,
        buildCommands: config.buildCommands || undefined,
        testCommands: config.testCommands || undefined,
        isConfirmed: config.isConfirmed || false,
        detectedFrom: config.detectedFrom || undefined,
        inferenceSource: config.inferenceSource || undefined,
        inferenceConfidence: config.inferenceConfidence || undefined,
      });
    } else {
      // No config found - will trigger runtime detection
      result.set(repoId, {
        repoId,
        url: repo?.url,
        isConfirmed: false,
      });
    }
  }

  return result;
}

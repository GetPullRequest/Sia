import {
  db,
  schema,
  type RepoConfig,
  type NewRepoConfig,
} from '../db/index.js';
import { eq } from 'drizzle-orm';

export interface CreateRepoConfigDto {
  repoId: string;
  orgId: string;
  executionStrategy?: 'auto' | 'devcontainer' | 'docker-compose' | 'custom';
  setupCommands?: string[];
  buildCommands?: string[];
  testCommands?: string[];
  validationStrategy?: {
    runBuild: boolean;
    runTests: boolean;
    runLinter: boolean;
  };
  envVarsNeeded?: string[];
  detectedLanguage?: string;
  detectedFrom?: string;
  devcontainerConfig?: {
    image: string | null;
    runArgs: string[];
  };
  // Confirmation tracking
  isConfirmed?: boolean;
  inferredAt?: Date;
  confirmedAt?: Date;
  inferenceSource?: string;
  inferenceConfidence?: 'high' | 'medium' | 'low';
}

export interface DetectedConfig {
  executionStrategy: 'auto' | 'devcontainer' | 'docker-compose' | 'custom';
  setupCommands: string[];
  buildCommands: string[];
  testCommands: string[];
  detectedLanguage: string;
  detectedFrom: string;
  confidence: 'high' | 'medium' | 'low';
  devcontainer?: {
    image: string | null;
    runArgs: string[];
  };
}

export class RepoConfigService {
  /**
   * Get repository configuration by repo ID
   */
  async getConfig(repoId: string): Promise<RepoConfig | null> {
    const [config] = await db
      .select()
      .from(schema.repoConfigs)
      .where(eq(schema.repoConfigs.repoId, repoId))
      .limit(1);

    return config || null;
  }

  /**
   * Save or update repository configuration
   * Uses upsert to handle both create and update cases
   */
  async saveConfig(dto: CreateRepoConfigDto): Promise<RepoConfig> {
    const config: NewRepoConfig = {
      repoId: dto.repoId,
      orgId: dto.orgId,
      executionStrategy: dto.executionStrategy || 'auto',
      setupCommands: dto.setupCommands || null,
      buildCommands: dto.buildCommands || null,
      testCommands: dto.testCommands || null,
      validationStrategy: dto.validationStrategy || {
        runBuild: true,
        runTests: true,
        runLinter: false,
      },
      envVarsNeeded: dto.envVarsNeeded || null,
      detectedLanguage: dto.detectedLanguage || null,
      detectedFrom: dto.detectedFrom || null,
      devcontainerConfig: dto.devcontainerConfig || null,
      // Confirmation tracking
      isConfirmed: dto.isConfirmed !== undefined ? dto.isConfirmed : false,
      inferredAt: dto.inferredAt || null,
      confirmedAt: dto.confirmedAt || null,
      inferenceSource: dto.inferenceSource || null,
      inferenceConfidence: dto.inferenceConfidence || null,
      updatedAt: new Date(),
    };

    // Check if config exists
    const existingConfig = await this.getConfig(dto.repoId);

    if (existingConfig) {
      // Update existing config
      const [updated] = await db
        .update(schema.repoConfigs)
        .set(config)
        .where(eq(schema.repoConfigs.repoId, dto.repoId))
        .returning();

      return updated;
    } else {
      // Insert new config
      const [inserted] = await db
        .insert(schema.repoConfigs)
        .values(config)
        .returning();

      return inserted;
    }
  }

  /**
   * Delete repository configuration
   */
  async deleteConfig(repoId: string): Promise<void> {
    await db
      .delete(schema.repoConfigs)
      .where(eq(schema.repoConfigs.repoId, repoId));
  }

  /**
   * Save auto-detected configuration
   * Convenience method for saving configs detected by the agent
   */
  async saveDetectedConfig(
    repoId: string,
    orgId: string,
    detected: DetectedConfig
  ): Promise<RepoConfig> {
    return this.saveConfig({
      repoId,
      orgId,
      executionStrategy: detected.executionStrategy,
      setupCommands: detected.setupCommands,
      buildCommands: detected.buildCommands,
      testCommands: detected.testCommands,
      detectedLanguage: detected.detectedLanguage,
      detectedFrom: detected.detectedFrom,
      devcontainerConfig: detected.devcontainer,
      // Mark as inferred (not confirmed)
      isConfirmed: false,
      inferredAt: new Date(),
      inferenceSource: detected.detectedFrom,
      inferenceConfidence: detected.confidence,
    });
  }

  /**
   * Confirm repository configuration
   * Marks the configuration as confirmed by the user
   */
  async confirmConfig(
    repoId: string,
    commands?: {
      setupCommands?: string[];
      buildCommands?: string[];
      testCommands?: string[];
    }
  ): Promise<RepoConfig> {
    const existingConfig = await this.getConfig(repoId);
    if (!existingConfig) {
      throw new Error(`Configuration not found for repo ${repoId}`);
    }

    return this.saveConfig({
      repoId: existingConfig.repoId,
      orgId: existingConfig.orgId,
      executionStrategy: existingConfig.executionStrategy || undefined,
      setupCommands:
        commands?.setupCommands ?? (existingConfig.setupCommands || undefined),
      buildCommands:
        commands?.buildCommands ?? (existingConfig.buildCommands || undefined),
      testCommands:
        commands?.testCommands ?? (existingConfig.testCommands || undefined),
      validationStrategy: existingConfig.validationStrategy || undefined,
      envVarsNeeded: existingConfig.envVarsNeeded || undefined,
      detectedLanguage: existingConfig.detectedLanguage || undefined,
      detectedFrom: existingConfig.detectedFrom || undefined,
      devcontainerConfig: existingConfig.devcontainerConfig || undefined,
      inferenceSource: existingConfig.inferenceSource || undefined,
      inferenceConfidence:
        (existingConfig.inferenceConfidence as 'high' | 'medium' | 'low') ||
        undefined,
      inferredAt: existingConfig.inferredAt || undefined,
      // Mark as confirmed
      isConfirmed: true,
      confirmedAt: new Date(),
    });
  }

  /**
   * Get configurations for multiple repos
   */
  async getConfigsForRepos(
    repoIds: string[]
  ): Promise<Map<string, RepoConfig>> {
    const configMap = new Map<string, RepoConfig>();

    // Fetch configs for all repos (one by one for now)
    // TODO: Optimize to fetch all at once with IN clause
    for (const repoId of repoIds) {
      const config = await this.getConfig(repoId);
      if (config) {
        configMap.set(repoId, config);
      }
    }

    return configMap;
  }

  /**
   * Get all configurations for an organization
   */
  async getConfigsForOrg(orgId: string): Promise<RepoConfig[]> {
    return await db
      .select()
      .from(schema.repoConfigs)
      .where(eq(schema.repoConfigs.orgId, orgId));
  }
}

// Export singleton instance
export const repoConfigService = new RepoConfigService();

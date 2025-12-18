import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { extractCommandsFromReadme } from './readme-command-extractor.js';
import { getValidAccessToken } from '../routes/github.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

interface DetectedConfig {
  setupCommands: string[];
  buildCommands: string[];
  testCommands: string[];
  description?: string;
  detectedFrom: string;
  confidence: 'high' | 'medium' | 'low';
}

export class RepoInferenceService {
  /**
   * Trigger inference for newly synced repos (background task)
   * Called after GitHub repos are synced
   */
  async inferConfigsForRepos(repoIds: string[], orgId: string): Promise<void> {
    console.log(
      `[RepoInference] Starting inference for ${repoIds.length} repos in org ${orgId}`
    );

    for (const repoId of repoIds) {
      try {
        // Check if config already exists and is confirmed
        const existingConfig = await db
          .select()
          .from(schema.repoConfigs)
          .where(eq(schema.repoConfigs.repoId, repoId))
          .limit(1);

        if (existingConfig[0]?.isConfirmed) {
          console.log(
            `[RepoInference] Skipping ${repoId} - config already confirmed`
          );
          continue;
        }

        // Get repo details
        const repo = await db
          .select()
          .from(schema.repos)
          .where(eq(schema.repos.id, repoId))
          .limit(1);

        if (!repo[0]) {
          console.warn(`[RepoInference] Repo ${repoId} not found, skipping`);
          continue;
        }

        console.log(`[RepoInference] Processing repo: ${repo[0].name}`);

        // Clone repo to temp location
        const tempPath = await this.cloneRepoTemporarily(
          repo[0].url,
          repo[0].repo_provider_id,
          orgId,
          repoId
        );

        try {
          // Run detection
          const detectedConfig = await this.detectConfig(tempPath);

          // Save config
          await this.saveDetectedConfig(repoId, orgId, detectedConfig);

          console.log(
            `[RepoInference] Successfully inferred config for ${repo[0].name} from ${detectedConfig.detectedFrom}`
          );
        } finally {
          // Always cleanup
          await this.cleanupTempClone(tempPath);
        }
      } catch (error) {
        console.error(
          `[RepoInference] Error inferring config for ${repoId}:`,
          error
        );
        // Continue with other repos - don't let one failure block others
      }
    }

    console.log(`[RepoInference] Completed inference for all repos`);
  }

  /**
   * Re-infer for single repo (manual trigger)
   */
  async reInferConfigForRepo(repoId: string, orgId: string): Promise<void> {
    console.log(`[RepoInference] Re-inferring config for repo ${repoId}`);

    const repo = await db
      .select()
      .from(schema.repos)
      .where(eq(schema.repos.id, repoId))
      .limit(1);

    if (!repo[0]) {
      throw new Error(`Repo ${repoId} not found`);
    }

    // Clone repo
    const tempPath = await this.cloneRepoTemporarily(
      repo[0].url,
      repo[0].repo_provider_id,
      orgId,
      repoId
    );

    try {
      // Detect config
      const detectedConfig = await this.detectConfig(tempPath);

      // Save config (update existing, reset isConfirmed)
      await this.saveDetectedConfig(repoId, orgId, detectedConfig);

      console.log(
        `[RepoInference] Successfully re-inferred config for ${repo[0].name}`
      );
    } finally {
      await this.cleanupTempClone(tempPath);
    }
  }

  /**
   * Detect configuration from a cloned repository
   */
  private async detectConfig(repoPath: string): Promise<DetectedConfig> {
    // Priority 1: README/CONTRIBUTING with LLM
    const readmeConfig = await this.detectFromReadme(repoPath);
    if (readmeConfig) {
      return readmeConfig;
    }

    // Priority 2: DevContainer
    const devcontainerConfig = await this.detectFromDevContainer(repoPath);
    if (devcontainerConfig) {
      return devcontainerConfig;
    }

    // Priority 3: Docker Compose
    const dockerComposeConfig = await this.detectFromDockerCompose(repoPath);
    if (dockerComposeConfig) {
      return dockerComposeConfig;
    }

    // Priority 4: Language heuristics (Node.js, Python, etc.)
    const languageConfig = await this.detectFromLanguage(repoPath);
    if (languageConfig) {
      return languageConfig;
    }

    // Fallback: No commands detected
    return {
      setupCommands: [],
      buildCommands: [],
      testCommands: [],
      description: undefined,
      detectedFrom: 'none',
      confidence: 'low',
    };
  }

  /**
   * Detect from README.md and CONTRIBUTING.md using LLM
   */
  private async detectFromReadme(
    repoPath: string
  ): Promise<DetectedConfig | null> {
    try {
      const readmePath = path.join(repoPath, 'README.md');
      const contributingPath = path.join(repoPath, 'CONTRIBUTING.md');

      let readmeContent = '';
      let contributingContent = '';

      try {
        readmeContent = await fs.readFile(readmePath, 'utf-8');
      } catch {
        // README not found, that's okay
      }

      try {
        contributingContent = await fs.readFile(contributingPath, 'utf-8');
      } catch {
        // CONTRIBUTING not found, that's okay
      }

      if (!readmeContent && !contributingContent) {
        return null;
      }

      // Use LLM to extract commands
      const result = await extractCommandsFromReadme(
        readmeContent,
        contributingContent
      );

      // Only return if we found at least one command
      if (
        result.setupCommands.length > 0 ||
        result.buildCommands.length > 0 ||
        result.testCommands.length > 0
      ) {
        return {
          setupCommands: result.setupCommands,
          buildCommands: result.buildCommands,
          testCommands: result.testCommands,
          description: result.description,
          detectedFrom: 'README.md',
          confidence: result.confidence as 'high' | 'medium' | 'low',
        };
      }

      return null;
    } catch (error) {
      console.warn('[RepoInference] README detection failed:', error);
      return null;
    }
  }

  /**
   * Detect from .devcontainer/devcontainer.json
   */
  private async detectFromDevContainer(
    repoPath: string
  ): Promise<DetectedConfig | null> {
    try {
      const devcontainerPath = path.join(
        repoPath,
        '.devcontainer',
        'devcontainer.json'
      );
      const devcontainerContent = await fs.readFile(devcontainerPath, 'utf-8');
      const config = JSON.parse(devcontainerContent);

      const setupCommands: string[] = [];
      const buildCommands: string[] = [];

      if (config.postCreateCommand) {
        setupCommands.push(config.postCreateCommand);
      }
      if (config.postStartCommand) {
        setupCommands.push(config.postStartCommand);
      }

      return {
        setupCommands,
        buildCommands,
        testCommands: [],
        detectedFrom: 'devcontainer.json',
        confidence: 'high',
      };
    } catch {
      return null;
    }
  }

  /**
   * Detect from docker-compose.yml
   */
  private async detectFromDockerCompose(
    repoPath: string
  ): Promise<DetectedConfig | null> {
    try {
      const dockerComposePath = path.join(repoPath, 'docker-compose.yml');
      await fs.access(dockerComposePath);

      return {
        setupCommands: ['docker-compose pull'],
        buildCommands: ['docker-compose build'],
        testCommands: [],
        detectedFrom: 'docker-compose.yml',
        confidence: 'high',
      };
    } catch {
      // Try .yaml extension
      try {
        const dockerComposePath = path.join(repoPath, 'docker-compose.yaml');
        await fs.access(dockerComposePath);

        return {
          setupCommands: ['docker-compose pull'],
          buildCommands: ['docker-compose build'],
          testCommands: [],
          detectedFrom: 'docker-compose.yaml',
          confidence: 'high',
        };
      } catch {
        return null;
      }
    }
  }

  /**
   * Detect from language-specific files (package.json, requirements.txt, etc.)
   */
  private async detectFromLanguage(
    repoPath: string
  ): Promise<DetectedConfig | null> {
    // Check for Node.js
    try {
      const packageJsonPath = path.join(repoPath, 'package.json');
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, 'utf-8')
      );

      const setupCommands = ['npm install'];
      const buildCommands: string[] = [];
      const testCommands: string[] = [];

      if (packageJson.scripts?.build) {
        buildCommands.push('npm run build');
      }
      if (packageJson.scripts?.test) {
        testCommands.push('npm test');
      }

      return {
        setupCommands,
        buildCommands,
        testCommands,
        detectedFrom: 'package.json',
        confidence: 'high',
      };
    } catch {
      // Not a Node.js project
    }

    // Check for Python
    try {
      const requirementsPath = path.join(repoPath, 'requirements.txt');
      await fs.access(requirementsPath);

      return {
        setupCommands: ['pip install -r requirements.txt'],
        buildCommands: [],
        testCommands: ['pytest'],
        detectedFrom: 'requirements.txt',
        confidence: 'high',
      };
    } catch {
      // Not a Python project with requirements.txt
    }

    // Check for Python with pyproject.toml
    try {
      const pyprojectPath = path.join(repoPath, 'pyproject.toml');
      await fs.access(pyprojectPath);

      return {
        setupCommands: ['pip install -e .'],
        buildCommands: [],
        testCommands: ['pytest'],
        detectedFrom: 'pyproject.toml',
        confidence: 'high',
      };
    } catch {
      // Not a Python project with pyproject.toml
    }

    return null;
  }

  /**
   * Clone repository to temporary location
   */
  private async cloneRepoTemporarily(
    repoUrl: string,
    repoProviderId: string,
    orgId: string,
    repoId: string
  ): Promise<string> {
    const tempId = uuidv4();
    const tempPath = `/tmp/inference/${orgId}/${repoId}/${tempId}`;

    console.log(`[RepoInference] Cloning ${repoUrl} to ${tempPath}`);

    await fs.mkdir(tempPath, { recursive: true });

    try {
      // Get provider
      const provider = await db
        .select()
        .from(schema.repoProviders)
        .where(eq(schema.repoProviders.id, repoProviderId))
        .limit(1);

      if (!provider[0]) {
        throw new Error(`Repository provider ${repoProviderId} not found`);
      }

      // Get valid access token (refreshes if expired)
      const token = await getValidAccessToken(provider[0]);

      // Inject access token into URL for private repos
      let cloneUrl = repoUrl;
      if (token) {
        if (repoUrl.includes('github.com')) {
          // Use x-access-token format for all GitHub token types
          // This works with personal access tokens, fine-grained tokens, and app tokens
          cloneUrl = repoUrl.replace(
            'https://github.com/',
            `https://x-access-token:${token}@github.com/`
          );
        } else {
          // For other git providers, use standard basic auth format
          cloneUrl = repoUrl.replace(
            'https://',
            `https://${token}:x-oauth-basic@`
          );
        }
      }

      console.log(
        `[RepoInference] Cloning with authenticated URL to ${tempPath}`
      );

      // Clone with depth 1 to save time/space
      await execAsync(`git clone --depth 1 "${cloneUrl}" "${tempPath}"`, {
        timeout: 60000, // 1 minute timeout
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0', // Disable interactive prompts
          GIT_ASKPASS: 'echo', // Provide empty password when asked
        },
      });

      console.log(`[RepoInference] Successfully cloned to ${tempPath}`);
      return tempPath;
    } catch (error) {
      // Cleanup on failure
      await this.cleanupTempClone(tempPath);

      // Provide more specific error message
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes('Repository not found') ||
        errorMessage.includes('not found')
      ) {
        throw new Error(
          `Failed to clone repository: Repository not found or access denied. Please check if the repository exists and the access token has proper permissions.`
        );
      }

      throw new Error(`Failed to clone repository: ${errorMessage}`);
    }
  }

  /**
   * Clean up temporary clone
   */
  private async cleanupTempClone(tempPath: string): Promise<void> {
    try {
      await fs.rm(tempPath, { recursive: true, force: true });
      console.log(`[RepoInference] Cleaned up ${tempPath}`);
    } catch (error) {
      console.warn(`[RepoInference] Failed to cleanup ${tempPath}:`, error);
    }
  }

  /**
   * Save detected config to database
   */
  private async saveDetectedConfig(
    repoId: string,
    orgId: string,
    detected: DetectedConfig
  ): Promise<void> {
    const configData = {
      repoId,
      orgId,
      setupCommands: detected.setupCommands,
      buildCommands: detected.buildCommands,
      testCommands: detected.testCommands,
      detectedFrom: detected.detectedFrom,
      inferenceSource: detected.detectedFrom,
      inferenceConfidence: detected.confidence,
      inferredAt: new Date(),
      isConfirmed: false, // Reset confirmation on new detection
      confirmedAt: null,
    };

    // Get existing config
    const existingConfig = await db
      .select()
      .from(schema.repoConfigs)
      .where(eq(schema.repoConfigs.repoId, repoId))
      .limit(1);

    if (existingConfig[0]) {
      // Update existing config
      await db
        .update(schema.repoConfigs)
        .set(configData)
        .where(eq(schema.repoConfigs.repoId, repoId));
    } else {
      // Insert new config
      await db.insert(schema.repoConfigs).values(configData);
    }

    // Update repo description if provided and repo doesn't have one
    if (detected.description) {
      const repo = await db
        .select({ description: schema.repos.description })
        .from(schema.repos)
        .where(eq(schema.repos.id, repoId))
        .limit(1);

      if (repo[0] && !repo[0].description) {
        await db
          .update(schema.repos)
          .set({ description: detected.description })
          .where(eq(schema.repos.id, repoId));
      }
    }
  }
}

export const repoInferenceService = new RepoInferenceService();

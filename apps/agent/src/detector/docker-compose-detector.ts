import * as fs from 'fs/promises';
import * as path from 'path';
import type { LanguageDetector, DetectedConfig } from './types.js';

/**
 * Detector for Docker Compose projects
 * Detects docker-compose.yml or docker-compose.yaml
 */
export class DockerComposeDetector implements LanguageDetector {
  async canDetect(repoPath: string): Promise<boolean> {
    try {
      // Check for docker-compose.yml first
      const composePath = path.join(repoPath, 'docker-compose.yml');
      await fs.access(composePath);
      return true;
    } catch {
      // Fall back to docker-compose.yaml
      try {
        const composeAltPath = path.join(repoPath, 'docker-compose.yaml');
        await fs.access(composeAltPath);
        return true;
      } catch {
        return false;
      }
    }
  }

  async detect(repoPath: string): Promise<DetectedConfig> {
    // Determine which compose file exists
    const ymlPath = path.join(repoPath, 'docker-compose.yml');
    const yamlPath = path.join(repoPath, 'docker-compose.yaml');

    const hasYml = await this.fileExists(ymlPath);
    const hasYaml = await this.fileExists(yamlPath);

    const detectedFrom = hasYml
      ? 'docker-compose.yml'
      : hasYaml
      ? 'docker-compose.yaml'
      : 'docker-compose.yml'; // Default fallback

    return {
      executionStrategy: 'docker-compose',
      setupCommands: ['docker-compose pull'], // Pull images
      buildCommands: ['docker-compose build'], // Build services
      testCommands: [], // Tests depend on compose service definitions
      detectedLanguage: 'docker-compose',
      detectedFrom,
      confidence: 'high', // Docker Compose is explicit configuration
    };
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

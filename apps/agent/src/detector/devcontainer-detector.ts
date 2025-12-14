import * as fs from 'fs/promises';
import * as path from 'path';
import type { LanguageDetector, DetectedConfig } from './types.js';

/**
 * Minimal DevContainer parser
 * Only extracts image and runArgs - ignores complex features
 */
export class DevContainerDetector implements LanguageDetector {
  async canDetect(repoPath: string): Promise<boolean> {
    try {
      const devcontainerPath = path.join(
        repoPath,
        '.devcontainer/devcontainer.json'
      );
      await fs.access(devcontainerPath);
      return true;
    } catch {
      return false;
    }
  }

  async detect(repoPath: string): Promise<DetectedConfig> {
    const devcontainerPath = path.join(
      repoPath,
      '.devcontainer/devcontainer.json'
    );

    try {
      const content = await fs.readFile(devcontainerPath, 'utf-8');

      // Strip JSON comments (devcontainer.json allows them)
      const jsonContent = this.stripJsonComments(content);

      const config = JSON.parse(jsonContent);

      return {
        executionStrategy: 'devcontainer',
        setupCommands: [], // DevContainer handles setup
        buildCommands: [], // DevContainer handles build
        testCommands: [], // Will be detected separately if needed
        detectedLanguage: 'devcontainer',
        detectedFrom: '.devcontainer/devcontainer.json',
        confidence: 'high', // DevContainer is explicit configuration
        devcontainer: {
          image: config.image || null,
          runArgs: config.runArgs || [],
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to parse devcontainer.json: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Strip JSON comments from devcontainer.json
   * Supports both // and /* *\/ style comments
   */
  private stripJsonComments(jsonString: string): string {
    // Remove single-line comments
    let result = jsonString.replace(/\/\/.*$/gm, '');

    // Remove multi-line comments
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');

    return result;
  }
}

import * as fs from 'fs/promises';
import * as path from 'path';
import type { LanguageDetector, DetectedConfig } from './types.js';

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Detector for Node.js projects (identifies via package.json)
 */
export class NodeJsDetector implements LanguageDetector {
  async canDetect(repoPath: string): Promise<boolean> {
    try {
      const packageJsonPath = path.join(repoPath, 'package.json');
      await fs.access(packageJsonPath);
      return true;
    } catch {
      return false;
    }
  }

  async detect(repoPath: string): Promise<DetectedConfig> {
    const packageJsonPath = path.join(repoPath, 'package.json');

    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson: PackageJson = JSON.parse(content);

      // Determine package manager (npm, yarn, pnpm)
      const packageManager = await this.detectPackageManager(repoPath);

      // Build setup commands
      const setupCommands = this.getSetupCommands(packageManager);

      // Build build commands
      const buildCommands = packageJson.scripts?.build
        ? [this.getRunCommand(packageManager, 'build')]
        : [];

      // Build test commands
      const testCommands = packageJson.scripts?.test
        ? [this.getRunCommand(packageManager, 'test')]
        : [];

      return {
        executionStrategy: 'auto',
        setupCommands,
        buildCommands,
        testCommands,
        detectedLanguage: 'nodejs',
        detectedFrom: 'package.json',
        confidence: 'high', // package.json is explicit and reliable
      };
    } catch (error) {
      throw new Error(
        `Failed to detect Node.js configuration: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  private async detectPackageManager(
    repoPath: string
  ): Promise<'npm' | 'yarn' | 'pnpm'> {
    // Check for lock files to determine package manager
    try {
      await fs.access(path.join(repoPath, 'pnpm-lock.yaml'));
      return 'pnpm';
    } catch {
      // Not pnpm
    }

    try {
      await fs.access(path.join(repoPath, 'yarn.lock'));
      return 'yarn';
    } catch {
      // Not yarn
    }

    // Default to npm
    return 'npm';
  }

  private getSetupCommands(packageManager: 'npm' | 'yarn' | 'pnpm'): string[] {
    switch (packageManager) {
      case 'pnpm':
        return ['pnpm install'];
      case 'yarn':
        return ['yarn install'];
      case 'npm':
      default:
        return ['npm install'];
    }
  }

  private getRunCommand(
    packageManager: 'npm' | 'yarn' | 'pnpm',
    script: string
  ): string {
    switch (packageManager) {
      case 'pnpm':
        return `pnpm run ${script}`;
      case 'yarn':
        return `yarn ${script}`;
      case 'npm':
      default:
        return `npm run ${script}`;
    }
  }
}

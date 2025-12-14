import * as fs from 'fs/promises';
import * as path from 'path';
import type { LanguageDetector, DetectedConfig } from './types.js';

/**
 * Detector for Python projects
 * Supports both requirements.txt and pyproject.toml
 */
export class PythonDetector implements LanguageDetector {
  async canDetect(repoPath: string): Promise<boolean> {
    try {
      // Check for pyproject.toml first (modern Python)
      const pyprojectPath = path.join(repoPath, 'pyproject.toml');
      await fs.access(pyprojectPath);
      return true;
    } catch {
      // Fall back to requirements.txt
      try {
        const requirementsPath = path.join(repoPath, 'requirements.txt');
        await fs.access(requirementsPath);
        return true;
      } catch {
        return false;
      }
    }
  }

  async detect(repoPath: string): Promise<DetectedConfig> {
    // Prefer pyproject.toml over requirements.txt
    const hasPyproject = await this.fileExists(
      path.join(repoPath, 'pyproject.toml')
    );
    const hasRequirements = await this.fileExists(
      path.join(repoPath, 'requirements.txt')
    );

    if (hasPyproject) {
      return this.detectPyproject(repoPath);
    } else if (hasRequirements) {
      return this.detectRequirements(repoPath);
    } else {
      throw new Error('No Python project files found');
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async detectPyproject(repoPath: string): Promise<DetectedConfig> {
    // For pyproject.toml, use pip install with editable mode
    return {
      executionStrategy: 'auto',
      setupCommands: ['pip install -e .'],
      buildCommands: [], // Python typically doesn't have a build step
      testCommands: ['pytest'], // Common test framework
      detectedLanguage: 'python',
      detectedFrom: 'pyproject.toml',
      confidence: 'high', // pyproject.toml is explicit and reliable
    };
  }

  private async detectRequirements(repoPath: string): Promise<DetectedConfig> {
    // For requirements.txt, use standard pip install
    return {
      executionStrategy: 'auto',
      setupCommands: ['pip install -r requirements.txt'],
      buildCommands: [], // Python typically doesn't have a build step
      testCommands: ['pytest'], // Common test framework
      detectedLanguage: 'python',
      detectedFrom: 'requirements.txt',
      confidence: 'high', // requirements.txt is explicit and reliable
    };
  }
}

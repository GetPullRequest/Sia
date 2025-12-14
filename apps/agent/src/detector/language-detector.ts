import { DevContainerDetector } from './devcontainer-detector.js';
import { DockerComposeDetector } from './docker-compose-detector.js';
import { ReadmeDetector } from './readme-detector.js';
import { NodeJsDetector } from './nodejs-detector.js';
import { PythonDetector } from './python-detector.js';
import { AutoDetectionError, type DetectedConfig } from './types.js';

/**
 * Main language detector that orchestrates all language-specific detectors
 *
 * Detection Priority:
 * 1. DevContainer (.devcontainer/devcontainer.json) - Highest confidence
 * 2. Docker Compose (docker-compose.yml) - Explicit configuration
 * 3. README/CONTRIBUTING (parsed markdown) - Medium confidence
 * 4. Node.js (package.json) - Language-specific heuristics
 * 5. Python (pyproject.toml or requirements.txt) - Language-specific heuristics
 * 6. Rust (Cargo.toml) - TODO
 * 7. Go (go.mod) - TODO
 * 8. Makefile - TODO
 */
export class LanguageDetectorService {
  private detectors = [
    new DevContainerDetector(), // Priority 1: Explicit container config
    new DockerComposeDetector(), // Priority 2: Explicit compose config
    new ReadmeDetector(), // Priority 3: Parsed documentation
    new NodeJsDetector(), // Priority 4: Language heuristics
    new PythonDetector(), // Priority 5: Language heuristics
    // TODO: Add RustDetector, GoDetector, MakefileDetector
  ];

  /**
   * Detect repository configuration using priority-ordered detectors
   */
  async detect(repoPath: string): Promise<DetectedConfig> {
    for (const detector of this.detectors) {
      try {
        const canDetect = await detector.canDetect(repoPath);
        if (canDetect) {
          const config = await detector.detect(repoPath);
          console.log(
            `Detected ${config.detectedLanguage} from ${config.detectedFrom}`
          );
          return config;
        }
      } catch (error) {
        // Log but continue to next detector
        console.warn(
          `Detector failed: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
        continue;
      }
    }

    // No detector succeeded
    throw new AutoDetectionError(
      'Unable to auto-detect execution strategy. Please configure this repository manually.'
    );
  }

  /**
   * Check if a repository can be auto-detected
   */
  async canDetect(repoPath: string): Promise<boolean> {
    for (const detector of this.detectors) {
      try {
        if (await detector.canDetect(repoPath)) {
          return true;
        }
      } catch {
        continue;
      }
    }
    return false;
  }
}

// Export singleton instance
export const languageDetectorService = new LanguageDetectorService();

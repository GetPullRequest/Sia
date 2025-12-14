/**
 * Configuration detected from a repository
 */
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

/**
 * Base interface for language detectors
 */
export interface LanguageDetector {
  /**
   * Detect if this detector can handle the repository
   */
  canDetect(repoPath: string): Promise<boolean>;

  /**
   * Detect and return configuration for the repository
   */
  detect(repoPath: string): Promise<DetectedConfig>;
}

/**
 * Error thrown when auto-detection fails
 */
export class AutoDetectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AutoDetectionError';
  }
}

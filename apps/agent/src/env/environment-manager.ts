import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Custom errors for environment variable issues
 */
export class MissingEnvFileError extends Error {
  constructor(
    message: string,
    public requiredVars: string[],
    public setupInstructions: string
  ) {
    super(message);
    this.name = 'MissingEnvFileError';
  }
}

export class MissingEnvKeysError extends Error {
  constructor(
    message: string,
    public missingKeys: string[],
    public envPath: string
  ) {
    super(message);
    this.name = 'MissingEnvKeysError';
  }
}

/**
 * Environment Manager handles loading and validating .env files
 * from the user's local machine (~/. sia/env/)
 *
 * Security: Environment variable VALUES are NEVER stored in the database
 * Only the KEYS are stored in repo configs to indicate what's needed
 */
export class EnvironmentManager {
  private envBasePath: string;

  constructor(basePathOverride?: string) {
    this.envBasePath =
      basePathOverride || path.join(os.homedir(), '.sia', 'env');
  }

  /**
   * Preflight check - verify all required env vars exist BEFORE job execution
   * Fails fast to avoid wasting time on setup/build
   */
  async preflightCheck(
    orgId: string,
    repoId: string,
    requiredVars: string[]
  ): Promise<void> {
    if (!requiredVars || requiredVars.length === 0) {
      return; // No env vars required
    }

    const envPath = this.getEnvPath(orgId, repoId);

    // Check if .env file exists
    try {
      await fs.access(envPath);
    } catch {
      throw new MissingEnvFileError(
        `Environment file not found: ${envPath}`,
        requiredVars,
        this.generateSetupInstructions(orgId, repoId, requiredVars)
      );
    }

    // Load and parse env file
    const envVars = await this.loadEnvVars(orgId, repoId);

    // Check all required keys are present
    const missingKeys = requiredVars.filter(key => !(key in envVars));

    if (missingKeys.length > 0) {
      throw new MissingEnvKeysError(
        `Missing required environment variables: ${missingKeys.join(', ')}`,
        missingKeys,
        envPath
      );
    }
  }

  /**
   * Load environment variables from .env file
   * Returns a map of KEY=VALUE pairs
   */
  async loadEnvVars(
    orgId: string,
    repoId: string
  ): Promise<Record<string, string>> {
    const envPath = this.getEnvPath(orgId, repoId);
    const content = await fs.readFile(envPath, 'utf-8');

    const envVars: Record<string, string> = {};

    for (const line of content.split('\n')) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Parse KEY=VALUE
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        // Join back in case value contains '='
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }

    return envVars;
  }

  /**
   * Get the path to the .env file for a specific repo
   */
  getEnvPath(orgId: string, repoId: string): string {
    // Sanitize repoId to create valid directory name
    const sanitizedRepoId = repoId
      .replace(/\//g, '-')
      .replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.envBasePath, orgId, sanitizedRepoId, '.env');
  }

  /**
   * Generate setup instructions for creating the .env file
   */
  private generateSetupInstructions(
    orgId: string,
    repoId: string,
    requiredVars: string[]
  ): string {
    const envPath = this.getEnvPath(orgId, repoId);
    const envDir = path.dirname(envPath);

    return `
# Setup Instructions for ${repoId}

mkdir -p ${envDir}
cat > ${envPath} <<EOF
${requiredVars.map(key => `${key}=your-value-here`).join('\n')}
EOF

# Verify
cat ${envPath}
    `.trim();
  }

  /**
   * Check if env file exists for a repo
   */
  async hasEnvFile(orgId: string, repoId: string): Promise<boolean> {
    try {
      const envPath = this.getEnvPath(orgId, repoId);
      await fs.access(envPath);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const environmentManager = new EnvironmentManager();

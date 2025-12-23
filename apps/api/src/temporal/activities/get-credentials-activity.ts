import { db, schema } from '../../db/index.js';
import { eq, and } from 'drizzle-orm';
import { getValidAccessToken } from '../../routes/github.js';
import { SecretStorageService } from '../../services/secrets/secret-storage-service.js';

export interface GitCredentials {
  token?: string;
  username?: string;
  password?: string;
}

export interface VibeCoderCredentials {
  type: 'cursor' | 'claude-code' | 'kiro-cli' | 'rovo-dev';
  executablePath?: string;
  apiKey?: string; // Cursor API key, Claude API key, etc.
}

export async function getGitCredentials(params: {
  jobId: string;
  orgId: string;
  repoId?: string;
}): Promise<GitCredentials> {
  // Get credentials from repo provider
  // Each org has different GitHub tokens via repo providers

  // If no repoId, try to get from environment (for development)
  if (!params.repoId) {
    if (process.env.GITHUB_TOKEN) {
      return {
        token: process.env.GITHUB_TOKEN,
        username: process.env.GITHUB_USERNAME,
      };
    }
    throw new Error('No repoId provided and no environment credentials found');
  }

  // Get repo to find the provider
  const repos = await db
    .select()
    .from(schema.repos)
    .where(
      and(
        eq(schema.repos.id, params.repoId),
        eq(schema.repos.orgId, params.orgId)
      )
    )
    .limit(1);

  if (!repos[0]) {
    throw new Error(`Repo ${params.repoId} not found`);
  }

  const repo = repos[0];

  // Get the repo provider
  const providers = await db
    .select()
    .from(schema.repoProviders)
    .where(
      and(
        eq(schema.repoProviders.id, repo.repo_provider_id),
        eq(schema.repoProviders.orgId, params.orgId)
      )
    )
    .limit(1);

  if (!providers[0]) {
    throw new Error(`Repo provider not found for repo ${params.repoId}`);
  }

  const provider = providers[0];

  // Get valid access token (handles token refresh for installations)
  const accessToken = await getValidAccessToken(provider);

  return {
    token: accessToken,
    username: provider.name || undefined,
  };
}

export async function getVibeCoderCredentials(params: {
  orgId: string;
  agentId?: string;
}): Promise<VibeCoderCredentials> {
  // If agentId provided, read vibeAgent and executablePath from agent record
  if (params.agentId) {
    const agent = await db
      .select({
        vibeAgent: schema.agents.vibeAgent,
        vibeAgentExecutablePath: schema.agents.vibeAgentExecutablePath,
        vibeConnectionId: schema.agents.vibeConnectionId,
      })
      .from(schema.agents)
      .where(
        and(
          eq(schema.agents.id, params.agentId),
          eq(schema.agents.orgId, params.orgId)
        )
      )
      .limit(1);

    if (agent[0]) {
      const vibeAgent = agent[0].vibeAgent || 'cursor';
      const executablePath = agent[0].vibeAgentExecutablePath;
      const vibeConnectionId = agent[0].vibeConnectionId;

      // Use executable path from agent record if available
      // Otherwise, fall back to default CLI command names (assumes they are installed and in PATH)
      let finalExecutablePath: string | undefined = executablePath || undefined;

      if (!finalExecutablePath) {
        const defaultCommands: Record<string, string> = {
          cursor: 'cursor-agent',
          'claude-code': 'claude',
          'kiro-cli': 'kiro-cli',
          'rovo-dev': 'rovo-dev',
        };

        finalExecutablePath =
          defaultCommands[vibeAgent] || vibeAgent.toLowerCase();

        console.log(
          `[getVibeCoderCredentials] No executable path configured for vibe-agent "${vibeAgent}". Assuming "${finalExecutablePath}" is available in PATH.`
        );
      }

      // Fetch API key from integration if vibeConnectionId is set
      let apiKey: string | undefined;
      if (vibeConnectionId) {
        const integration = await db
          .select({
            accessToken: schema.integrations.accessToken,
            metadata: schema.integrations.metadata,
          })
          .from(schema.integrations)
          .where(
            and(
              eq(schema.integrations.id, vibeConnectionId),
              eq(schema.integrations.orgId, params.orgId)
            )
          )
          .limit(1);

        if (integration[0]?.accessToken) {
          try {
            // Get storage type from metadata (defaults to 'encrypted_local' if not specified)
            const metadata =
              (integration[0].metadata as Record<string, unknown> | null) || {};
            const storageType =
              (metadata.secretStorageType as
                | 'gcp'
                | 'encrypted_local'
                | undefined) || 'encrypted_local';

            // Decrypt the access token using SecretStorageService
            const secretStorageService = new SecretStorageService();
            apiKey = await secretStorageService.retrieveSecret(
              integration[0].accessToken,
              storageType
            );

            console.log(
              `[getVibeCoderCredentials] Found and decrypted API key for vibe-agent "${vibeAgent}" from integration ${vibeConnectionId}`
            );
          } catch (decryptError) {
            console.error(
              `[getVibeCoderCredentials] Failed to decrypt API key for integration ${vibeConnectionId}:`,
              decryptError
            );
            throw new Error(
              `Failed to decrypt API key: ${
                decryptError instanceof Error
                  ? decryptError.message
                  : 'Unknown error'
              }`
            );
          }
        }
      }

      return {
        type: vibeAgent as 'cursor' | 'claude-code' | 'kiro-cli' | 'rovo-dev',
        executablePath: finalExecutablePath,
        apiKey,
      };
    }
  }

  // If no agentId provided or agent not found, use default (v0 behavior)
  console.log(
    '[getVibeCoderCredentials] No agentId provided or agent not found. Using default vibe-agent (cursor) from PATH.'
  );

  return {
    type: 'cursor', // Default to cursor for v0
    executablePath: 'cursor-agent', // Assume cursor is in PATH
  };
}

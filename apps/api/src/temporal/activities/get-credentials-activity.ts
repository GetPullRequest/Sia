import { db, schema } from '../../db/index.js';
import { eq, and } from 'drizzle-orm';
import { SecretStorageService } from '../../services/secrets/secret-storage-service.js';
import { getValidAccessToken } from '../../routes/github.js';

export interface GitCredentials {
  token?: string;
  username?: string;
  password?: string;
}

export interface VibeCoderCredentials {
  type: 'cursor' | 'claude-code' | 'kiro-cli';
  executablePath?: string;
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
  const secretStorageService = new SecretStorageService();

  // If agentId provided, read vibeAgent and executablePath from agent record
  if (params.agentId) {
    const agent = await db
      .select({
        vibeAgent: schema.agents.vibeAgent,
        vibeAgentExecutablePath: schema.agents.vibeAgentExecutablePath,
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

      // Get vibe-agent credentials from integrations table
      // Look for integration with providerType matching the vibe-agent type
      const integration = await db
        .select()
        .from(schema.integrations)
        .where(
          and(
            eq(schema.integrations.orgId, params.orgId),
            eq(schema.integrations.providerType, vibeAgent)
          )
        )
        .limit(1);

      let decryptedExecutablePath: string | undefined =
        executablePath || undefined;

      // If integration found and has accessToken, decrypt it to get executable path
      if (integration[0]?.accessToken) {
        const metadata = integration[0].metadata as Record<
          string,
          unknown
        > | null;
        const storageType = metadata?.secretStorageType as
          | 'gcp'
          | 'encrypted_local'
          | undefined;

        if (storageType) {
          try {
            decryptedExecutablePath = await secretStorageService.retrieveSecret(
              integration[0].accessToken,
              storageType
            );
          } catch (error) {
            console.error(
              `Failed to decrypt vibe-agent executable path: ${error}`
            );
            // Fall back to executablePath from agent record or undefined
          }
        }
      }

      // If no executable path found, assume CLI is in PATH (v0 behavior)
      if (!decryptedExecutablePath) {
        // Use default CLI command names (assumes they are installed and in PATH)
        const defaultCommands: Record<string, string> = {
          cursor: 'cursor',
          'claude-code': 'claude',
          'kiro-cli': 'kiro-cli',
        };

        decryptedExecutablePath =
          defaultCommands[vibeAgent] || vibeAgent.toLowerCase();

        console.log(
          `[getVibeCoderCredentials] No executable path configured for vibe-agent "${vibeAgent}". Assuming "${decryptedExecutablePath}" is available in PATH.`
        );
      }

      return {
        type: vibeAgent as 'cursor' | 'claude-code' | 'kiro-cli',
        executablePath: decryptedExecutablePath,
      };
    }
  }

  // If no agentId provided or agent not found, use default (v0 behavior)
  console.log(
    '[getVibeCoderCredentials] No agentId provided or agent not found. Using default vibe-agent (cursor) from PATH.'
  );

  return {
    type: 'cursor', // Default to cursor for v0
    executablePath: 'cursor', // Assume cursor is in PATH
  };
}

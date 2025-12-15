import { db, schema } from '../../db/index.js';
import { eq, and } from 'drizzle-orm';
import { SecretStorageService } from '../../services/secrets/secret-storage-service.js';
import { getInstallationToken } from '../../routes/github.js';

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
  let accessToken: string;
  const installationId = provider.metadata?.installation_id;

  if (!installationId) {
    // PAT or standard user token
    if (!provider.access_token) {
      throw new Error('No access token available for repo provider');
    }
    accessToken = provider.access_token;
  } else {
    // Installation token - check if needs refresh
    const tokenMissing = !provider.access_token;
    const createdAt = provider.token_created_at
      ? new Date(provider.token_created_at)
      : new Date(provider.createdAt);
    const expiresIn = provider.expires_in || 0;
    const expiresAt = new Date(createdAt.getTime() + expiresIn * 1000);
    const now = new Date();
    const bufferSeconds = 300;
    const needsRefresh =
      tokenMissing ||
      expiresIn === 0 ||
      expiresAt.getTime() - now.getTime() < bufferSeconds * 1000;

    if (needsRefresh) {
      const tokenData = await getInstallationToken(installationId);

      // Update token in database
      await db
        .update(schema.repoProviders)
        .set({
          access_token: tokenData.token,
          expires_in: Math.floor(
            (tokenData.expiresAt.getTime() - Date.now()) / 1000
          ),
          token_created_at: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.repoProviders.id, provider.id));

      accessToken = tokenData.token;
    } else {
      accessToken = provider.access_token || '';
    }
  }

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

      // If no executable path found (neither from agent record nor integrations), throw error
      if (!decryptedExecutablePath) {
        const errorMessage = `No executable path configured for vibe-agent "${vibeAgent}". Please configure it in agent settings or integrations.`;

        // Update job status to failed with error message
        // Note: We need jobId to update job, but it's not available in params
        // The workflow will handle the error and update the job
        throw new Error(errorMessage);
      }

      return {
        type: vibeAgent as 'cursor' | 'claude-code' | 'kiro-cli',
        executablePath: decryptedExecutablePath,
      };
    }
  }

  // If no agentId provided or agent not found, throw error
  throw new Error(
    'Agent not found or no agentId provided. Cannot determine vibe-agent credentials.'
  );
}

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  db,
  schema,
  type Repo,
  type NewRepo,
  type RepoProvider,
  type NewRepoProvider,
} from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { getCurrentUser, type User } from '../auth/index.js';
import { repoInferenceService } from '../services/repo-inference.service.js';
import { RepoProviderService } from '../services/repo-provider.service.js';

const { repos, repoProviders } = schema;

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

interface GitHubInstallationCallback {
  installation_id: string;
  setup_action?: string;
  state?: string;
}

interface GitHubInstallationTokenResponse {
  token: string;
  expires_at: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
}

interface GitHubInstallation {
  id: number;
  account: {
    login: string;
    type: string;
    name?: string;
  };
  repository_selection: 'all' | 'selected';
  repositories?: Array<{ id: number; name: string; full_name: string }>;
}

interface GitHubOrganization {
  login: string;
  name: string | null;
  type: string;
}

function generateGitHubAppJWT(): string {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error('GitHub App ID or Private Key not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + 60 * 10,
    iss: appId,
  };

  return jwt.sign(payload, privateKey.replace(/\\n/g, '\n'), {
    algorithm: 'RS256',
  });
}

export async function getInstallationToken(
  installationId: string
): Promise<{ token: string; expiresAt: Date }> {
  const jwtToken = generateGitHubAppJWT();

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get installation token: ${errorText}`);
  }

  const tokenData = (await response.json()) as GitHubInstallationTokenResponse;

  return {
    token: tokenData.token,
    expiresAt: new Date(tokenData.expires_at),
  };
}

async function paginateApi(url: string, token: string): Promise<unknown[]> {
  const out: unknown[] = [];
  let next: string | null = url;
  while (next) {
    const res = await fetch(next, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`GitHub API error ${res.status} ${txt}`);
    }
    const page = (await res.json()) as unknown;
    // some endpoints return wrapper object with repositories
    if (Array.isArray(page)) {
      out.push(...page);
    } else if (
      page &&
      typeof page === 'object' &&
      page !== null &&
      'repositories' in page &&
      Array.isArray(page.repositories)
    ) {
      out.push(...(page.repositories as unknown[]));
    } else {
      // single page with non array body return as single item
      out.push(page);
    }
    const link = res.headers.get('link') || '';
    const m = link.match(/<([^>]+)>;\s*rel="next"/);
    next = m ? m[1] : null;
  }
  return out;
}

function transformProviderResponse(provider: RepoProvider) {
  return {
    id: provider.id,
    name: provider.name,
    description: provider.description,
    access_token: provider.access_token,
    refresh_token: provider.refresh_token,
    expires_in: provider.expires_in,
    token_created_at: provider.token_created_at
      ? provider.token_created_at.toISOString()
      : undefined,
    metadata: provider.metadata,
    repo_provider_app_name: provider.repo_provider_app_name,
    created_at: provider.createdAt.toISOString(),
    updated_at: provider.updatedAt.toISOString(),
  };
}

function transformRepoResponse(repo: Repo) {
  return {
    id: repo.id,
    name: repo.name,
    description: repo.description,
    url: repo.url,
    repo_provider_id: repo.repo_provider_id,
    created_at: repo.createdAt.toISOString(),
    updated_at: repo.updatedAt.toISOString(),
  };
}

export async function getValidAccessToken(
  provider: RepoProvider
): Promise<string> {
  // If provider is a PAT or standard user token
  const installationId = provider.metadata?.installation_id;
  if (!installationId) {
    if (!provider.access_token) throw new Error('No access token available');
    return provider.access_token;
  }

  // installation flow
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

    await db
      .update(repoProviders)
      .set({
        access_token: tokenData.token,
        expires_in: Math.floor(
          (tokenData.expiresAt.getTime() - Date.now()) / 1000
        ),
        token_created_at: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(repoProviders.id, provider.id));

    return tokenData.token;
  }

  return provider.access_token || '';
}

async function reposRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: { name?: string; description?: string; use_pat?: string };
  }>(
    '/repos/github/connect',
    {
      schema: {
        tags: ['repos'],
        description: 'Initiate GitHub App installation or PAT fallback',
        querystring: {
          $ref: 'ConnectGitHubRequest#',
        },
        response: {
          200: {
            description:
              'Redirect URL in JSON format (when Accept: application/json)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    redirectUrl: {
                      type: 'string',
                      description:
                        'URL to redirect to for GitHub App installation',
                    },
                  },
                  required: ['redirectUrl'],
                },
              },
            },
          },
          302: {
            description:
              'Redirect to GitHub App installation or PAT page (when not requesting JSON)',
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          400: {
            description: 'Bad Request',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          500: {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
        },
      },
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getCurrentUser(request, reply);
        request.user = user;
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: { name?: string; description?: string; use_pat?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const githubAppId = process.env.GITHUB_APP_ID;
        const state = uuidv4();

        // Check if client wants JSON response (for CORS compatibility)
        const wantsJson = request.headers.accept?.includes('application/json');

        if (request.query.use_pat === 'true') {
          reply.setCookie('use_pat', 'true', {
            path: '/',
            httpOnly: true,
            maxAge: 600,
          });
          reply.setCookie('oauth_state', state, {
            path: '/',
            httpOnly: true,
            maxAge: 600,
          });
          if (request.query.name || request.query.description) {
            reply.setCookie('repo_provider_name', request.query.name || '', {
              path: '/',
              httpOnly: true,
              maxAge: 600,
            });
            reply.setCookie(
              'repo_provider_description',
              request.query.description || '',
              { path: '/', httpOnly: true, maxAge: 600 }
            );
          }
          const patUrl = `${request.protocol}://${request.hostname}/repos/github/connect/pat?state=${state}`;
          if (wantsJson) {
            return reply.code(200).send({ redirectUrl: patUrl });
          }
          return reply.redirect(patUrl);
        }

        if (!githubAppId) {
          return reply
            .code(400)
            .send({ error: 'GitHub App ID not configured' });
        }

        const installUrl = `https://github.com/apps/${
          process.env.GITHUB_APP_SLUG || 'sia'
        }/installations/new?state=${state}`;

        if (request.query.name || request.query.description) {
          reply.setCookie('repo_provider_name', request.query.name || '', {
            path: '/',
            httpOnly: true,
            maxAge: 600,
          });
          reply.setCookie(
            'repo_provider_description',
            request.query.description || '',
            { path: '/', httpOnly: true, maxAge: 600 }
          );
        }

        reply.setCookie('oauth_state', state, {
          path: '/',
          httpOnly: true,
          maxAge: 600,
        });

        // Return JSON if client requests it (for CORS compatibility)
        if (wantsJson) {
          return reply.code(200).send({ redirectUrl: installUrl });
        }

        return reply.redirect(installUrl);
      } catch (error) {
        fastify.log.error(
          { err: error },
          'Failed to initiate GitHub connection'
        );
        return reply
          .code(500)
          .send({ error: 'Failed to initiate GitHub connection' });
      }
    }
  );

  fastify.get<{ Querystring: GitHubInstallationCallback }>(
    '/repos/github/connect/callback',
    {
      schema: {
        tags: ['repos'],
        description: 'Handle GitHub App installation callback',
        querystring: {
          $ref: 'ConnectGitHubCallbackRequest#',
        },
        response: {
          200: {
            description: 'Installation successful',
            content: {
              'application/json': {
                schema: {
                  $ref: 'RepoProvider#',
                },
              },
            },
          },
          400: {
            description: 'Bad Request',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          500: {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
        },
      },
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getCurrentUser(request, reply);
        request.user = user;
      },
    },
    async (
      request: FastifyRequest<{ Querystring: GitHubInstallationCallback }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { installation_id, state } = request.query;
        const providerName = request.cookies.repo_provider_name || 'GitHub';
        const providerDescription =
          request.cookies.repo_provider_description || '';

        if (!installation_id) {
          return reply.code(400).send({ error: 'Installation ID is required' });
        }

        // Optional: Validate state parameter for CSRF protection if provided
        if (state) {
          const storedState = request.cookies.oauth_state;
          if (storedState && state !== storedState) {
            return reply.code(400).send({ error: 'Invalid state parameter' });
          }
        }

        const orgId = user.orgId;

        const jwtToken = generateGitHubAppJWT();

        const installationResponse = await fetch(
          `https://api.github.com/app/installations/${installation_id}`,
          {
            headers: {
              Authorization: `Bearer ${jwtToken}`,
              Accept: 'application/vnd.github+json',
            },
          }
        );

        if (!installationResponse.ok) {
          const txt = await installationResponse.text();
          fastify.log.error({ txt }, 'Failed to fetch installation details');
          return reply
            .code(400)
            .send({ error: 'Failed to fetch installation details' });
        }

        const installation =
          (await installationResponse.json()) as GitHubInstallation;

        const tokenData = await getInstallationToken(installation_id);

        // TODO: Make all these logic async

        // Fetch organization/account details to get the actual name
        let accountName = installation.account.login;
        if (installation.account.type === 'Organization') {
          try {
            const orgResponse = await fetch(
              `https://api.github.com/orgs/${installation.account.login}`,
              {
                headers: {
                  Authorization: `Bearer ${tokenData.token}`,
                  Accept: 'application/vnd.github+json',
                },
              }
            );
            if (orgResponse.ok) {
              const orgData = (await orgResponse.json()) as GitHubOrganization;
              accountName = orgData.name || orgData.login;
            }
          } catch (error) {
            fastify.log.warn(
              { err: error },
              'Failed to fetch organization details, using login'
            );
          }
        } else if (installation.account.type === 'User') {
          try {
            const userResponse = await fetch(
              `https://api.github.com/users/${installation.account.login}`,
              {
                headers: {
                  Authorization: `Bearer ${tokenData.token}`,
                  Accept: 'application/vnd.github+json',
                },
              }
            );
            if (userResponse.ok) {
              const userData =
                (await userResponse.json()) as GitHubOrganization;
              accountName = userData.name || userData.login;
            }
          } catch (error) {
            fastify.log.warn(
              { err: error },
              'Failed to fetch user details, using login'
            );
          }
        }

        const providerId = uuidv4();
        const appId = process.env.GITHUB_APP_ID || '';

        const newRepoProvider: NewRepoProvider = {
          id: providerId,
          orgId: orgId,
          name: providerName || accountName,
          description: providerDescription || accountName,
          access_token: tokenData.token,
          refresh_token: null,
          expires_in: Math.floor(
            (tokenData.expiresAt.getTime() - Date.now()) / 1000
          ),
          metadata: {
            installation_id: installation_id,
            app_id: appId,
          },
          repo_provider_app_name: 'github',
        };

        const createdProvider = await db
          .insert(repoProviders)
          .values(newRepoProvider)
          .returning();

        // persist token creation time and expiry
        await db
          .update(repoProviders)
          .set({
            token_created_at: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(repoProviders.id, providerId));

        reply.clearCookie('oauth_state');
        reply.clearCookie('repo_provider_name');
        reply.clearCookie('repo_provider_description');
        reply.clearCookie('org_id');

        // fetch installation repositories with pagination
        try {
          const installationRepos = await paginateApi(
            `https://api.github.com/installation/repositories?per_page=100`,
            tokenData.token
          );
          const reposToInsert: NewRepo[] = (
            installationRepos as GitHubRepo[]
          ).map(repo => ({
            id: repo.id.toString(),
            orgId: orgId,
            name: repo.name,
            description: repo.description || null,
            url: repo.html_url,
            repo_provider_id: providerId,
          }));

          if (reposToInsert.length > 0) {
            await db.insert(repos).values(reposToInsert).onConflictDoNothing();

            // Trigger async inference for newly synced repos (fire-and-forget)
            const repoIds = reposToInsert.map(r => r.id);
            repoInferenceService
              .inferConfigsForRepos(repoIds, orgId)
              .catch(err => {
                fastify.log.error(
                  { err },
                  'Background inference failed for newly synced repos'
                );
                // Don't block the callback response
              });
          }
        } catch (err) {
          fastify.log.error(
            { err },
            'Failed to fetch installation repositories, continuing'
          );
        }

        // Return JSON response - frontend will handle the redirect
        return reply.send(
          transformProviderResponse(createdProvider[0] as RepoProvider)
        );
      } catch (error) {
        fastify.log.error(
          { err: error },
          'Failed to complete GitHub installation'
        );
        return reply
          .code(500)
          .send({ error: 'Failed to complete GitHub installation' });
      }
    }
  );

  fastify.post<{ Body: { pat: string; name?: string; description?: string } }>(
    '/repos/github/connect/pat',
    {
      schema: {
        tags: ['repos'],
        description: 'Connect using Personal Access Token (fallback)',
        body: {
          $ref: 'ConnectPATRequest#',
        },
        response: {
          200: {
            description: 'PAT connection successful',
            content: {
              'application/json': {
                schema: {
                  $ref: 'RepoProvider#',
                },
              },
            },
          },
          400: {
            description: 'Bad Request',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          500: {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
        },
      },
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getCurrentUser(request, reply);
        request.user = user;
      },
    },
    async (
      request: FastifyRequest<{
        Body: { pat: string; name?: string; description?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { pat, name, description } = request.body;

        const userResponse = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${pat}`,
            Accept: 'application/vnd.github+json',
          },
        });

        if (!userResponse.ok) {
          return reply
            .code(400)
            .send({ error: 'Invalid Personal Access Token' });
        }

        const userData = (await userResponse.json()) as { login: string };
        const providerId = uuidv4();

        const newRepoProvider: NewRepoProvider = {
          id: providerId,
          orgId: user.orgId,
          name: name || 'GitHub (PAT)',
          description:
            description ||
            `GitHub account: ${userData.login} (Personal Access Token)`,
          access_token: pat,
          refresh_token: null,
          expires_in: 0,
          metadata: null,
          repo_provider_app_name: 'github',
        };

        const createdProvider = await db
          .insert(repoProviders)
          .values(newRepoProvider)
          .returning();

        return reply.send(
          transformProviderResponse(createdProvider[0] as RepoProvider)
        );
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to connect with PAT');
        return reply
          .code(500)
          .send({ error: 'Failed to connect with Personal Access Token' });
      }
    }
  );

  fastify.get(
    '/repos/github/providers',
    {
      schema: {
        tags: ['repos'],
        description:
          'Get all GitHub repo providers for the current organization',
        response: {
          200: {
            description: 'List of GitHub repo providers',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: 'RepoProvider#',
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          500: {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
        },
      },
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getCurrentUser(request, reply);
        request.user = user;
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user!;

        const providers = await db
          .select()
          .from(repoProviders)
          .where(
            and(
              eq(repoProviders.orgId, user.orgId),
              eq(repoProviders.repo_provider_app_name, 'github')
            )
          );

        return reply.send(providers.map(transformProviderResponse));
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to fetch GitHub providers');
        return reply
          .code(500)
          .send({ error: 'Failed to fetch GitHub providers' });
      }
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/repos/github/providers/:id',
    {
      schema: {
        tags: ['repos'],
        description: 'Disconnect a repo provider',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Repo provider disconnected successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'DisconnectProviderResponse#',
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          404: {
            description: 'Repo provider not found',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          500: {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
        },
      },
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getCurrentUser(request, reply);
        request.user = user;
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { id } = request.params;

        await RepoProviderService.disconnectProvider(id, user.orgId);

        return reply.send({
          message: 'Repo provider disconnected successfully',
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === 'Repo provider not found'
        ) {
          return reply.code(404).send({ error: 'Repo provider not found' });
        }

        fastify.log.error({ err: error }, 'Failed to disconnect repo provider');
        return reply
          .code(500)
          .send({ error: 'Failed to disconnect repo provider' });
      }
    }
  );

  fastify.get<{ Params: { providerId: string } }>(
    '/repos/github/providers/:providerId/repos',
    {
      schema: {
        tags: ['repos'],
        description:
          'Get all repos for a GitHub repo provider (fetched from GitHub API)',
        params: {
          type: 'object',
          properties: {
            providerId: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'List of repos from GitHub',
            content: {
              'application/json': {
                schema: {
                  $ref: 'GetReposResponse#',
                },
              },
            },
          },
          400: {
            description: 'Bad Request',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          404: {
            description: 'Repo provider not found',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          500: {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
        },
      },
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getCurrentUser(request, reply);
        request.user = user;
      },
    },
    async (
      request: FastifyRequest<{ Params: { providerId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { providerId } = request.params;

        const providerRow = await db
          .select()
          .from(repoProviders)
          .where(
            and(
              eq(repoProviders.id, providerId),
              eq(repoProviders.orgId, user.orgId)
            )
          )
          .limit(1);
        const provider = providerRow[0];

        if (!provider) {
          return reply.code(404).send({ error: 'Repo provider not found' });
        }

        if (provider.repo_provider_app_name !== 'github') {
          return reply
            .code(400)
            .send({ error: 'This endpoint is only for GitHub providers' });
        }

        let accessToken: string;
        try {
          accessToken = await getValidAccessToken(provider);
        } catch (error) {
          fastify.log.error({ err: error }, 'Token generation failed');
          return reply.code(401).send({
            error:
              'Failed to generate access token. Please reconnect your GitHub account.',
          });
        }

        let githubRepos: GitHubRepo[] = [];

        const installationId = provider.metadata?.installation_id;
        if (installationId) {
          // installation repositories endpoint supports pagination and returns wrapper object
          const reposPaginated = await paginateApi(
            `https://api.github.com/installation/repositories?per_page=100`,
            accessToken
          );
          // paginateApi returns array of repositories or items, normalize
          githubRepos = reposPaginated as GitHubRepo[];
        } else {
          // user token path
          const url =
            'https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator,organization_member';
          githubRepos = (await paginateApi(url, accessToken)) as GitHubRepo[];
        }

        const reposResult = githubRepos.map(repo => ({
          id: repo.id.toString(),
          name: repo.name,
          description: repo.description || null,
          url: repo.html_url,
          repo_provider_id: providerId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        return reply.send(reposResult);
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to fetch repos');
        return reply.code(500).send({ error: 'Failed to fetch repos' });
      }
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/repos/github/:id',
    {
      schema: {
        tags: ['repos'],
        description: 'Get a repo by ID',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Repo retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'Repo#',
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          404: {
            description: 'Repo not found',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          500: {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
        },
      },
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getCurrentUser(request, reply);
        request.user = user;
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { id } = request.params;

        const repo = await db
          .select()
          .from(repos)
          .where(and(eq(repos.id, id), eq(repos.orgId, user.orgId)))
          .limit(1);

        if (!repo[0]) {
          return reply.code(404).send({ error: 'Repo not found' });
        }

        return reply.send(transformRepoResponse(repo[0]));
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to fetch repo');
        return reply.code(500).send({ error: 'Failed to fetch repo' });
      }
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/repos/github/providers/:id/token',
    {
      schema: {
        tags: ['repos'],
        description:
          'Get repo provider token by ID (returns installation token if available)',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Token retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: 'RepoProviderToken#',
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          404: {
            description: 'Repo provider not found',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
          500: {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: {
                  $ref: 'ErrorResponse#',
                },
              },
            },
          },
        },
      },
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        const user = await getCurrentUser(request, reply);
        request.user = user;
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const user = request.user!;
        const { id } = request.params;

        const providerRow = await db
          .select({
            access_token: repoProviders.access_token,
            refresh_token: repoProviders.refresh_token,
            expires_in: repoProviders.expires_in,
            metadata: repoProviders.metadata,
            token_created_at: repoProviders.token_created_at,
          })
          .from(repoProviders)
          .where(
            and(eq(repoProviders.id, id), eq(repoProviders.orgId, user.orgId))
          )
          .limit(1);

        if (!providerRow[0]) {
          return reply.code(404).send({ error: 'Repo provider not found' });
        }

        const provider = providerRow[0];

        let token = provider.access_token;
        const installationId = provider.metadata?.installation_id;
        if (installationId) {
          try {
            const tokenData = await getInstallationToken(installationId);
            token = tokenData.token;
          } catch (error) {
            fastify.log.error(
              { err: error },
              'Failed to get installation token'
            );
          }
        }

        return reply.send({
          access_token: token,
          refresh_token: provider.refresh_token || '',
          expires_in: provider.expires_in,
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to fetch token');
        return reply.code(500).send({ error: 'Failed to fetch token' });
      }
    }
  );
}

export default reposRoutes;

import { FastifyRequest, FastifyReply } from 'fastify';
import { db, schema } from '../db/index';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';

export interface User {
  id: string;
  email: string;
  orgId: string;
  role: 'admin' | 'viewer';
  name?: string;
}

interface AuthMethods {
  validateAccessTokenAndGetUser: (authorizationHeader: string) => Promise<{
    userId: string;
    email: string;
    activeOrgId?: string | null;
    orgIdToOrgMemberInfo?: Record<string, {
      assignedRole?: string;
    }>;
    firstName?: string | null;
    lastName?: string | null;
  }>;
}

let auth: AuthMethods | null = null;
let authInitializationAttempted = false;

async function getAuth(): Promise<AuthMethods | null> {
  if (auth === null && !authInitializationAttempted) {
    authInitializationAttempted = true;
    try {
      const { initBaseAuth } = await import('@propelauth/node');
      const authUrl = process.env.PROPEL_AUTH_URL;
      const apiKey = process.env.PROPEL_VERIFICATION_KEY;

      if (!authUrl || !apiKey) {
        console.warn('PropelAuth not configured - using mock auth for development');
        return null;
      }

      const authInstance = initBaseAuth({
        authUrl,
        apiKey,
      });

      auth = {
        validateAccessTokenAndGetUser: authInstance.validateAccessTokenAndGetUser,
      };
    } catch (error) {
      console.warn(`Failed to initialize PropelAuth: ${error}`);
      return null;
    }
  }
  return auth;
}

function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

async function authenticateWithApiKey(
  apiKey: string,
  reply: FastifyReply
): Promise<User> {
  try {
    const { apiKeys } = schema;
    
    // Hash the provided API key for lookup
    const keyHash = hashApiKey(apiKey);
    
    // Find the API key by hash (fast lookup)
    const [storedKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);
    
    if (!storedKey) {
      return reply.code(401).send({
        error: 'Invalid API key',
      }) as never;
    }

    // Update lastUsedAt
    await db
      .update(apiKeys)
      .set({ 
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, storedKey.id));

    // Return user info
    return {
      id: storedKey.userId,
      email: `api-key-${storedKey.id}@api.sia`,
      orgId: storedKey.orgId,
      role: 'admin',
      name: storedKey.name,
    };
  } catch (error) {
    console.error('API key authentication error:', error);
    return reply.code(401).send({
      error: 'API key authentication failed',
    }) as never;
  }
}

export async function getCurrentUser(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<User> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return reply.code(401).send({
        error: 'Missing authentication credentials',
      }) as never;
    }

    // Check if it's an API key (starts with "sia_sk_")
    // Handle both "sia_sk_..." and "Bearer sia_sk_..." formats
    const apiKey = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7).trim()
      : authHeader.trim();

    if (apiKey.startsWith('sia_sk_')) {
      return await authenticateWithApiKey(apiKey, reply);
    }

    // Otherwise, treat it as a Bearer token from PropelAuth
    const authInstance = await getAuth();

    if (!authInstance) {
      // Mock authentication for development
      return {
        id: 'dev_user',
        email: 'dev@example.com',
        orgId: 'dev_org',
        role: 'admin',
        name: 'Dev User',
      };
    }

    const user = await authInstance.validateAccessTokenAndGetUser(authHeader);

    let orgId: string;
    let role: 'admin' | 'viewer';

    if (user.activeOrgId) {
      orgId = user.activeOrgId;
      const orgMemberInfo = user.orgIdToOrgMemberInfo?.[user.activeOrgId];

      if (!orgMemberInfo) {
        return reply.code(401).send({
          error: 'User is not a member of any organization',
        }) as never;
      }

      const userRole = orgMemberInfo.assignedRole?.toLowerCase() || 'viewer';
      role = userRole === 'admin' || userRole === 'owner' ? 'admin' : 'viewer';
    } else {
      // Individual user - use user_id as org_id
      orgId = user.userId;
      role = 'admin';
    }

    // Build user name
    let name: string | undefined;
    if (user.firstName && user.lastName) {
      name = `${user.firstName} ${user.lastName}`;
    } else if (user.firstName) {
      name = user.firstName;
    } else if (user.lastName) {
      name = user.lastName;
    }

    return {
      id: user.userId,
      email: user.email,
      orgId,
      role,
      name,
    };
  } catch (error: unknown) {
    const err = error as { name?: string; status?: number; message?: string };
    if (err.name === 'UnauthorizedException' || err.status === 401) {
      return reply.code(401).send({
        error: 'Invalid authentication credentials',
      }) as never;
    }

    console.error(`Authentication error: ${err.message || error}`);
    return reply.code(401).send({
      error: 'Authentication failed',
    }) as never;
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<User> {
  const user = await getCurrentUser(request, reply);

  if (user.role !== 'admin') {
    return reply.code(403).send({
      error: 'Admin access required',
    }) as never;
  }

  return user;
}


import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import * as schema from './schema';

const getPoolConfig = (): PoolConfig => {
  // If DATABASE_URL is set, use it directly
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
    };
  }

  // Otherwise, use individual connection parameters
  // This allows password to be undefined (for trust/md5 auth) without causing SCRAM errors
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD;
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '5432', 10);
  const database = process.env.DB_NAME || 'sia';

  const config: PoolConfig = {
    user,
    host,
    port,
    database,
  };

  // Only include password if it's provided (allows trust authentication)
  if (password !== undefined && password !== '') {
    config.password = password;
  }

  return config;
};

const poolConfig = getPoolConfig();

if (!process.env.DATABASE_URL && !process.env.DB_USER) {
  console.warn('⚠️  Database connection not fully configured.');
  console.warn(
    '⚠️  Set DATABASE_URL or individual DB_* environment variables (DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME)'
  );
}

const pool = new Pool(poolConfig);

export const db = drizzle(pool, { schema });
export { schema };
export type {
  Job,
  NewJob,
  Repo,
  NewRepo,
  RepoConfig,
  NewRepoConfig,
  RepoProvider,
  NewRepoProvider,
  Integration,
  NewIntegration,
  Activity,
  NewActivity,
  ActivityReadStatus,
  NewActivityReadStatus,
  Agent,
  NewAgent,
  ApiKey,
  NewApiKey,
  LogEntry,
} from './schema';

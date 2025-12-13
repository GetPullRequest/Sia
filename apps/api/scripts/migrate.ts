import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgresql://localhost:5432/sia',
});

const db = drizzle(pool);

async function runMigrations() {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/sia';
  const isProduction = process.env.NODE_ENV === 'production';

  console.log(
    `Running migrations in ${
      isProduction ? 'PRODUCTION' : 'development'
    } mode...`
  );
  console.log(`Database: ${dbUrl.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`Migrations folder: ${path.join(__dirname, '../drizzle')}`);
  console.log('');

  try {
    await migrate(db, {
      migrationsFolder: path.join(__dirname, '../drizzle'),
    });
    console.log('✅ Migrations completed successfully!');
    console.log('');
    console.log(
      'Note: Drizzle tracks applied migrations in the __drizzle_migrations table.'
    );
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();

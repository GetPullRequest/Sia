import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { eq, and, desc } from 'drizzle-orm';
import { createHash } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config();

function logDirectoryTree(dirPath: string, maxDepth = 3, currentDepth = 0, prefix = ''): void {
  if (currentDepth >= maxDepth) return;
  
  try {
    if (!fs.existsSync(dirPath)) {
      console.log(`${prefix}${path.basename(dirPath)}/ (does not exist)`);
      return;
    }
    
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      console.log(`${prefix}${path.basename(dirPath)} (file)`);
      return;
    }
    
    console.log(`${prefix}${path.basename(dirPath)}/`);
    const entries = fs.readdirSync(dirPath).sort();
    
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const fullPath = path.join(dirPath, entry);
      const isLast = i === entries.length - 1;
      const newPrefix = prefix + (isLast ? '└── ' : '├── ');
      const nextPrefix = prefix + (isLast ? '    ' : '│   ');
      
      try {
        const entryStats = fs.statSync(fullPath);
        if (entryStats.isDirectory()) {
          logDirectoryTree(fullPath, maxDepth, currentDepth + 1, nextPrefix);
        } else {
          console.log(`${newPrefix}${entry}`);
        }
      } catch (e) {
        console.log(`${newPrefix}${entry} (error reading: ${e})`);
      }
    }
  } catch (e) {
    console.log(`${prefix}${path.basename(dirPath)}/ (error: ${e})`);
  }
}

function loadSchema() {
  console.log('=== Schema Loading Debug Info ===');
  console.log(`process.cwd(): ${process.cwd()}`);
  console.log(`__dirname: ${__dirname}`);
  console.log(`require.main?.filename: ${require.main?.filename || 'undefined'}`);
  console.log(`process.argv[1]: ${process.argv[1]}`);
  
  const scriptDir = __dirname || path.dirname(require.main?.filename || process.argv[1] || '');
  const baseDir = path.resolve(scriptDir, '..');
  const distPath = path.resolve(baseDir, 'dist/db/schema.js');
  const srcPath = path.resolve(baseDir, 'src/db/schema.ts');
  
  console.log(`\nComputed paths:`);
  console.log(`  scriptDir: ${scriptDir}`);
  console.log(`  baseDir: ${baseDir}`);
  console.log(`  distPath: ${distPath}`);
  console.log(`  srcPath: ${srcPath}`);
  
  console.log(`\nChecking file existence:`);
  console.log(`  distPath exists: ${fs.existsSync(distPath)}`);
  console.log(`  srcPath exists: ${fs.existsSync(srcPath)}`);
  
  if (fs.existsSync(distPath)) {
    console.log(`✅ Found schema at distPath: ${distPath}`);
    return require('../dist/db/schema');
  } else if (fs.existsSync(srcPath)) {
    console.log(`✅ Found schema at srcPath: ${srcPath}`);
    return require('../src/db/schema');
  } else {
    console.log(`\n❌ Schema file not found. Exploring directory structure...`);
    
    const distDir = path.resolve(baseDir, 'dist');
    const srcDir = path.resolve(baseDir, 'src');
    
    console.log(`\nDirectory existence:`);
    console.log(`  baseDir exists: ${fs.existsSync(baseDir)}`);
    console.log(`  distDir exists: ${fs.existsSync(distDir)}`);
    console.log(`  srcDir exists: ${fs.existsSync(srcDir)}`);
    
    if (fs.existsSync(baseDir)) {
      console.log(`\nbaseDir contents (${baseDir}):`);
      try {
        const baseContents = fs.readdirSync(baseDir);
        console.log(`  ${baseContents.join(', ')}`);
      } catch (e) {
        console.log(`  Error reading baseDir: ${e}`);
      }
      
      console.log(`\n=== Directory Tree Structure (${baseDir}) ===`);
      logDirectoryTree(baseDir, 4);
    }
    
    if (fs.existsSync(distDir)) {
      console.log(`\ndistDir contents (${distDir}):`);
      try {
        const distContents = fs.readdirSync(distDir);
        console.log(`  ${distContents.join(', ')}`);
        
        const dbInDist = path.resolve(distDir, 'db');
        if (fs.existsSync(dbInDist)) {
          console.log(`\ndist/db contents (${dbInDist}):`);
          const dbContents = fs.readdirSync(dbInDist);
          console.log(`  ${dbContents.join(', ')}`);
          
          const schemaFiles = dbContents.filter(f => f.includes('schema'));
          console.log(`\nSchema-related files in dist/db:`);
          schemaFiles.forEach(file => {
            const fullPath = path.resolve(dbInDist, file);
            console.log(`  - ${file} (exists: ${fs.existsSync(fullPath)})`);
          });
        } else {
          console.log(`  dist/db does not exist`);
        }
      } catch (e) {
        console.log(`  Error reading distDir: ${e}`);
      }
    }
    
    if (fs.existsSync(srcDir)) {
      console.log(`\nsrcDir contents (${srcDir}):`);
      try {
        const srcContents = fs.readdirSync(srcDir);
        console.log(`  ${srcContents.join(', ')}`);
        
        const dbInSrc = path.resolve(srcDir, 'db');
        if (fs.existsSync(dbInSrc)) {
          console.log(`\nsrc/db contents (${dbInSrc}):`);
          const dbContents = fs.readdirSync(dbInSrc);
          console.log(`  ${dbContents.join(', ')}`);
        }
      } catch (e) {
        console.log(`  Error reading srcDir: ${e}`);
      }
    }
    
    let errorMsg = `Cannot find schema file. Checked:\n  - ${distPath}\n  - ${srcPath}\n`;
    errorMsg += `  Script dir: ${scriptDir}\n`;
    errorMsg += `  Base dir: ${baseDir}\n`;
    errorMsg += `  Current working directory: ${process.cwd()}\n`;
    
    throw new Error(errorMsg);
  }
}

const schema = loadSchema();
const { jobs, activities } = schema;

console.log('Schema loaded successfully');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/sia',
});

const db = drizzle(pool);

const ORG_IDS = [
  '916b6662-0f9f-4651-b7f4-c02d88c1fdd6',
  'b6e109eb-9d64-41e5-809a-93e8d8df71f2',
];
const SYSTEM_USER = 'system-seed';

function generateJobId(title: string, orgId: string): string {
  const hash = createHash('sha256')
    .update(`${orgId}-${title}`)
    .digest('hex')
    .substring(0, 32);
  return `job-${hash}`;
}

function generateActivityId(baseId: string, orgId: string): string {
  const hash = createHash('sha256')
    .update(`${orgId}-${baseId}`)
    .digest('hex')
    .substring(0, 32);
  return `act-${hash}`;
}

interface SeedJob {
  title: string;
  desc: string;
  status: 'queued' | 'in-progress' | 'completed' | 'failed' | 'in-review';
  order?: number;
}

const seedJobs: SeedJob[] = [
  {
    title: 'Add onboarding flow',
    desc: 'Show a short two page tutorial after sign up. Page one explains what Sia can do. Page two explains how to use Sia.',
    status: 'queued',
    order: 1,
  },
  {
    title: 'Improve job timeline UI',
    desc: 'Add visual progress indicators and show how long each job takes with a small clock tick.',
    status: 'queued',
    order: 1,
  },
  {
    title: 'Add keyboard shortcuts for new task',
    desc: 'Add shortcuts to create new task in dashboard ("c" is the shortcut to create new task) and indicate that in the UI tool tip.',
    status: 'queued',
    order: 2,
  },
  {
    title: 'Add token consumption details',
    desc: 'For each task show token usage and the estimated cost after generation. Get that data from jobs table. Show these in the metadata section.',
    status: 'queued',
    order: 3,
  },
  {
    title: 'Public task boards',
    desc: 'Allow users to create boards that anyone can view and manage tasks publically.',
    status: 'queued',
    order: 4,
  },
  {
    title: 'Add linear integration',
    desc: 'Similar to existing github & slack integrations, add an integration with linear to sync issue updates between Sia and Linear.',
    status: 'in-progress',
  },
  {
    title: 'Restrict free tier users',
    desc: 'Restrict free tier users from creating more than 10 PRs per month.',
    status: 'in-review',
  },
  {
    title: 'Support Claude Agent headless integration',
    desc: 'Allow users to use Claude Agent headless mode to create PRs.',
    status: 'in-review',
  },
  {
    title: 'Fix authentication issue',
    desc: 'Support both user level and org level authentication using propelauth\'s organization based authentication.',
    status: 'completed',
  },
  {
    title: 'Permissions',
    desc: 'Allow only "Admins" for any mutation operations. Otherwise show a permission error.',
    status: 'completed',
  },
  {
    title: 'Fix test configurations',
    desc: 'Tests are not running in api project due to fastify configuration issues. Please fix those.',
    status: 'failed',
  },
];

interface SeedActivity {
  id: string;
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  summary: string;
  createdBy: string;
  updatedBy: string;
}

const seedActivities: SeedActivity[] = [
  {
    id: 'evt1',
    name: 'Add onboarding flow',
    status: 'queued',
    summary: 'Sia queued the work to add the onboarding tutorial.',
    createdBy: 'sia.system',
    updatedBy: 'sia.system',
  },
  {
    id: 'evt2',
    name: 'Improve job timeline UI',
    status: 'queued',
    summary: 'Sia queued the work to improve the job timeline interface.',
    createdBy: 'sia.system',
    updatedBy: 'sia.system',
  },
  {
    id: 'evt3',
    name: 'Add keyboard shortcuts for new task',
    status: 'queued',
    summary: 'Sia queued the work to add keyboard shortcuts for creating tasks.',
    createdBy: 'sia.system',
    updatedBy: 'sia.system',
  },
  {
    id: 'evt4',
    name: 'Add token consumption details',
    status: 'queued',
    summary: 'Sia queued the work to show token usage and cost for each task.',
    createdBy: 'sia.system',
    updatedBy: 'sia.system',
  },
  {
    id: 'evt5',
    name: 'Public task boards',
    status: 'queued',
    summary: 'Sia queued the work to support public task boards.',
    createdBy: 'sia.system',
    updatedBy: 'sia.system',
  },
  {
    id: 'evt6',
    name: 'Add linear integration',
    status: 'in_progress',
    summary: 'Sia started working on syncing tasks between Sia and Linear.',
    createdBy: 'sia.system',
    updatedBy: 'sia.system',
  },
  {
    id: 'evt7',
    name: 'Restrict free tier users',
    status: 'in_progress',
    summary: 'Sia started implementing the free tier limit for PRs.',
    createdBy: 'sia.system',
    updatedBy: 'sia.system',
  },
  {
    id: 'evt8',
    name: 'Support Claude Agent headless integration',
    status: 'in_progress',
    summary: 'Sia started adding support for Claude Agent headless mode.',
    createdBy: 'sia.system',
    updatedBy: 'sia.system',
  },
  {
    id: 'evt9',
    name: 'Fix authentication issue',
    status: 'completed',
    summary: 'Sia fixed the authentication issue by adding user and org level auth handling.',
    createdBy: 'sia.system',
    updatedBy: 'sia.system',
  },
  {
    id: 'evt10',
    name: 'Permissions',
    status: 'completed',
    summary: 'Sia completed the permissions update and now restricts mutations to admins.',
    createdBy: 'sia.system',
    updatedBy: 'sia.system',
  },
  {
    id: 'evt11',
    name: 'Fix test configurations',
    status: 'failed',
    summary: 'Sia attempted to fix the API test setup but the process failed with Fastify config issues.',
    createdBy: 'sia.system',
    updatedBy: 'sia.system',
  },
];

async function seedDatabase() {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/sia';
  const isProduction = process.env.NODE_ENV === 'production';
  
  console.log(`Seeding database in ${isProduction ? 'PRODUCTION' : 'development'} mode...`);
  console.log(`Database: ${dbUrl.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`OrgIds: ${ORG_IDS.join(', ')}`);
  console.log('');

  try {
    await db.select().from(activities).limit(1);
    console.log('✅ Activities table exists and is accessible');
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not exist')) {
      console.error('❌ Activities table does not exist. Please run migrations first:');
      console.error('   npm run db:migrate -w @sia/api');
      throw new Error('Activities table not found. Run migrations before seeding.');
    }
    throw error;
  }

  try {
    for (const ORG_ID of ORG_IDS) {
      console.log(`\n📦 Seeding data for org: ${ORG_ID}`);
      
      for (const seedJob of seedJobs) {
        const jobId = generateJobId(seedJob.title, ORG_ID);
        
        const existingJob = await db
          .select()
          .from(jobs)
          .where(and(eq(jobs.id, jobId), eq(jobs.orgId, ORG_ID)))
          .orderBy(desc(jobs.version))
          .limit(1);

        const jobData = {
          id: jobId,
          version: existingJob[0]?.version ?? 1,
          orgId: ORG_ID,
          generatedName: seedJob.title,
          generatedDescription: seedJob.desc,
          status: seedJob.status,
          orderInQueue: seedJob.order ?? 0,
          createdBy: existingJob[0]?.createdBy ?? SYSTEM_USER,
          updatedBy: SYSTEM_USER,
          priority: 'medium' as const,
        };

        if (existingJob[0]) {
          await db
            .update(jobs)
            .set({
              ...jobData,
              updatedAt: new Date(),
            })
            .where(and(eq(jobs.id, jobId), eq(jobs.orgId, ORG_ID), eq(jobs.version, existingJob[0].version)));
          console.log(`✅ Updated job: ${seedJob.title}`);
        } else {
          await db.insert(jobs).values(jobData);
          console.log(`✅ Created job: ${seedJob.title}`);
        }
      }

      const allJobs = await db
        .select()
        .from(jobs)
        .where(eq(jobs.orgId, ORG_ID))
        .orderBy(desc(jobs.version));

      const jobMap = new Map<string, string>();
      for (const job of allJobs) {
        if (!jobMap.has(job.generatedName || '')) {
          jobMap.set(job.generatedName || '', job.id);
        }
      }

      for (const seedActivity of seedActivities) {
        const jobId = jobMap.get(seedActivity.name);
        
        if (!jobId) {
          console.warn(`⚠️  Skipping activity ${seedActivity.id}: no job found with title "${seedActivity.name}"`);
          continue;
        }
        
        const activityId = generateActivityId(seedActivity.id, ORG_ID);
        
        const existingActivity = await db
          .select()
          .from(activities)
          .where(eq(activities.id, activityId))
          .limit(1);

        const activityData = {
          id: activityId,
          name: seedActivity.name,
          status: seedActivity.status,
          jobId: jobId,
          summary: seedActivity.summary,
          createdBy: seedActivity.createdBy,
          updatedBy: seedActivity.updatedBy,
        };

        if (existingActivity[0]) {
          await db
            .update(activities)
            .set({
              ...activityData,
              updatedAt: new Date(),
            })
            .where(eq(activities.id, activityId));
          console.log(`✅ Updated activity: ${seedActivity.name}`);
        } else {
          await db.insert(activities).values(activityData);
          console.log(`✅ Created activity: ${seedActivity.name}`);
        }
      }
    }

    console.log('');
    console.log('✅ Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedDatabase();

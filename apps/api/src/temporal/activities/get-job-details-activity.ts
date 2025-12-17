import { db, schema } from '../../db/index.js';
import { eq, and } from 'drizzle-orm';

export async function getJobDetails(params: {
  jobId: string;
  jobVersion: number;
  orgId: string;
}): Promise<{
  prompt: string;
  repos?: string[] | null;
  orderInQueue: number;
  queueType: 'rework' | 'backlog' | null;
} | null> {
  const jobResult = await db
    .select({
      prompt: schema.jobs.userInput,
      repos: schema.jobs.repos,
      orderInQueue: schema.jobs.orderInQueue,
      queueType: schema.jobs.queueType,
    })
    .from(schema.jobs)
    .where(
      and(
        eq(schema.jobs.id, params.jobId),
        eq(schema.jobs.version, params.jobVersion),
        eq(schema.jobs.orgId, params.orgId)
      )
    )
    .limit(1);

  if (!jobResult[0]) {
    return null;
  }

  const job = jobResult[0];
  return {
    prompt: (job.prompt as any)?.prompt || '',
    repos: job.repos || undefined,
    orderInQueue: job.orderInQueue,
    queueType: job.queueType as 'rework' | 'backlog' | null,
  };
}

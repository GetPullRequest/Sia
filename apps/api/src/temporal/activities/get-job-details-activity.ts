import { db, schema } from '../../db/index';
import { eq, and, desc } from 'drizzle-orm';

export async function getJobDetails(params: {
  jobId: string;
  orgId: string;
}): Promise<{
  prompt: string;
  repoId?: string;
  orderInQueue: number;
  queueType: 'rework' | 'backlog' | null;
} | null> {
  const jobResult = await db
    .select({
      prompt: schema.jobs.userInput,
      repoId: schema.jobs.repoId,
      orderInQueue: schema.jobs.orderInQueue,
      queueType: schema.jobs.queueType,
    })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.id, params.jobId), eq(schema.jobs.orgId, params.orgId)))
    .orderBy(desc(schema.jobs.version))
    .limit(1);

  if (!jobResult[0]) {
    return null;
  }

  const job = jobResult[0];
  return {
    prompt: (job.prompt as any)?.prompt || '',
    repoId: job.repoId || undefined,
    orderInQueue: job.orderInQueue,
    queueType: job.queueType as 'rework' | 'backlog' | null,
  };
}


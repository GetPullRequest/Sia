import { db, schema } from '../../db/index';
import { eq, and, sql } from 'drizzle-orm';

export async function removeJobFromQueue(params: {
  jobId: string;
  orgId: string;
  queueType: 'rework' | 'backlog';
  orderInQueue: number;
}): Promise<void> {
  await db
    .update(schema.jobs)
    .set({
      queueType: null,
      orderInQueue: -1,
      updatedAt: new Date(),
    })
    .where(
      and(eq(schema.jobs.id, params.jobId), eq(schema.jobs.orgId, params.orgId))
    );
}

export async function reprioritizeQueueAfterRemoval(params: {
  orgId: string;
  queueType: 'rework' | 'backlog';
  removedPosition: number;
}): Promise<void> {
  await db
    .update(schema.jobs)
    .set({
      orderInQueue: sql`${schema.jobs.orderInQueue} - 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.jobs.orgId, params.orgId),
        eq(schema.jobs.status, 'queued'),
        eq(schema.jobs.queueType, params.queueType),
        sql`${schema.jobs.orderInQueue} > ${params.removedPosition}`
      )
    );
}

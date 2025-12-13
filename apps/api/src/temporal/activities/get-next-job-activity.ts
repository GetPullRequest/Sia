import { db, schema } from '../../db/index';
import { eq, and, asc, sql } from 'drizzle-orm';

/**
 * Atomically claim the next job from a queue
 * Uses SELECT FOR UPDATE SKIP LOCKED to ensure only one agent can claim a job
 * This prevents race conditions when multiple agents try to pick up the same job
 *
 * The atomic operation:
 * 1. Locks and selects the next job (SKIP LOCKED ensures no blocking)
 * 2. Updates it to in-progress and removes from queue
 * 3. Reprioritizes remaining jobs
 *
 * If multiple agents try to claim at the same time, only one will succeed.
 */
export async function claimNextJobFromQueue(params: {
  orgId: string;
  queueType: 'rework' | 'backlog';
}): Promise<{ jobId: string; orderInQueue: number } | null> {
  // Use a transaction to atomically claim the job
  const result = await db.transaction(async tx => {
    // Use raw SQL for SELECT FOR UPDATE SKIP LOCKED
    // This PostgreSQL feature ensures only one transaction can lock a row
    // If a row is locked, SKIP LOCKED moves to the next available row
    const jobsResult = await tx.execute(sql`
      SELECT id, order_in_queue
      FROM ${schema.jobs}
      WHERE org_id = ${params.orgId}
        AND status = 'queued'
        AND queue_type = ${params.queueType}
      ORDER BY order_in_queue ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);

    if (jobsResult.rows.length === 0) {
      return null;
    }

    const job = jobsResult.rows[0] as { id: string; order_in_queue: number };
    const jobId = job.id;
    const orderInQueue = job.order_in_queue;

    // Atomically update the job to remove it from queue and mark as in-progress
    // The WHERE clause ensures it's still queued (double-check)
    const updated = await tx
      .update(schema.jobs)
      .set({
        status: 'in-progress',
        queueType: null,
        orderInQueue: -1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.jobs.id, jobId),
          eq(schema.jobs.orgId, params.orgId),
          eq(schema.jobs.status, 'queued'), // Double-check it's still queued
          eq(schema.jobs.queueType, params.queueType)
        )
      )
      .returning({
        id: schema.jobs.id,
      });

    if (updated.length === 0) {
      // Job was already claimed by another agent (shouldn't happen due to lock, but handle it)
      return null;
    }

    // Reprioritize the queue by decrementing orderInQueue for jobs after this one
    await tx
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
          sql`${schema.jobs.orderInQueue} > ${orderInQueue}`
        )
      );

    return {
      jobId: updated[0].id,
      orderInQueue,
    };
  });

  return result;
}

/**
 * @deprecated Use claimNextJobFromQueue instead for atomic job claiming
 * This is kept for backward compatibility but should not be used in new code
 */
export async function getNextJobFromQueue(params: {
  orgId: string;
  queueType: 'rework' | 'backlog';
}): Promise<{ jobId: string } | null> {
  const jobs = await db
    .select()
    .from(schema.jobs)
    .where(
      and(
        eq(schema.jobs.orgId, params.orgId),
        eq(schema.jobs.status, 'queued'),
        eq(schema.jobs.queueType, params.queueType)
      )
    )
    .orderBy(asc(schema.jobs.orderInQueue))
    .limit(1);

  if (jobs.length === 0) {
    return null;
  }

  return { jobId: jobs[0].id };
}

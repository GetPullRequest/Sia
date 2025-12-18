import { db, schema } from '../../db/index.js';

/**
 * Set pause state for a queue
 */
export async function setQueuePaused(params: {
  orgId: string;
  queueType: 'rework' | 'backlog';
  isPaused: boolean;
}): Promise<void> {
  try {
    await db
      .insert(schema.queueStates)
      .values({
        orgId: params.orgId,
        queueType: params.queueType,
        isPaused: params.isPaused,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.queueStates.orgId, schema.queueStates.queueType],
        set: {
          isPaused: params.isPaused,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Error setting queue pause state:', error);
    throw error;
  }
}

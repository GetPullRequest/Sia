import { db, schema, type NewActivity } from '../../db/index';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// Helper function to create activity
async function createActivity(
  jobId: string,
  name: string,
  summary: string,
  userId: string,
  orgId: string
): Promise<void> {
  try {
    const activityId = uuidv4();
    const newActivity: NewActivity = {
      id: activityId,
      orgId,
      name,
      jobId,
      summary,
      createdBy: userId,
      updatedBy: userId,
      codeGenerationLogs: null,
      verificationLogs: null,
    };

    await db.insert(schema.activities).values(newActivity);
  } catch (error) {
    console.error('Failed to create activity:', error);
  }
}

export async function updateJobStatus(params: {
  jobId: string;
  orgId: string;
  status: string;
  prLink?: string;
  error?: string;
}): Promise<void> {
  // Get current job to create activity
  const jobResult = await db
    .select()
    .from(schema.jobs)
    .where(and(
      eq(schema.jobs.id, params.jobId),
      eq(schema.jobs.orgId, params.orgId)
    ))
    .orderBy(desc(schema.jobs.version))
    .limit(1);
  
  const currentJob = jobResult[0];
  const oldStatus = currentJob?.status;

  // Build update message for the updates field
  let updateMessage = '';
  if (currentJob && oldStatus !== params.status) {
    const timestamp = new Date().toLocaleString();
    
    if (params.status === 'failed') {
      updateMessage = `Job execution failed at ${timestamp}.`;
      if (params.error) {
        updateMessage += ` Error details: ${params.error}`;
      }
    } else if (params.status === 'completed') {
      updateMessage = `Job completed successfully at ${timestamp}.`;
      if (params.prLink) {
        updateMessage += ` PR created: ${params.prLink}`;
      }
    } else if (params.status === 'in-review') {
      updateMessage = `Job moved to review state at ${timestamp}.`;
      if (params.prLink) {
        updateMessage += ` PR link: ${params.prLink}`;
      }
    } else if (params.status === 'in-progress') {
      updateMessage = `Job execution started at ${timestamp}.`;
    } else if (params.status === 'queued') {
      updateMessage = `Job queued at ${timestamp}.`;
    } else {
      updateMessage = `Job status changed from ${oldStatus} to ${params.status} at ${timestamp}.`;
    }
  }

  // Prepend new updates (latest first)
  const existingUpdates = currentJob?.updates || '';
  const newUpdates = updateMessage
    ? existingUpdates 
      ? `${updateMessage}\n${existingUpdates}` 
      : updateMessage
    : existingUpdates;

  await db
    .update(schema.jobs)
    .set({
      status: params.status as any,
      prLink: params.prLink,
      updates: updateMessage ? newUpdates : existingUpdates,
      updatedAt: new Date(),
    })
    .where(and(
      eq(schema.jobs.id, params.jobId),
      eq(schema.jobs.orgId, params.orgId)
    ));

  // Create activity for status changes
  if (currentJob && oldStatus !== params.status) {
    const jobName = currentJob.generatedName || 'Untitled Job';
    let activityName = 'Job Status Updated';
    let activitySummary = `Job "${jobName}" status was changed from ${oldStatus} to ${params.status}.`;

    if (params.status === 'completed') {
      activityName = 'Job Completed';
      activitySummary = `Job "${jobName}" was completed and moved to review state.`;
      if (params.prLink) {
        activitySummary += ` PR created: ${params.prLink}`;
      }
    } else if (params.status === 'failed') {
      activityName = 'Job Failed';
      activitySummary = `Job "${jobName}" execution failed.`;
      if (params.error) {
        activitySummary += ` Error: ${params.error}`;
      }
    } else if (params.status === 'in-review') {
      activityName = 'Job In Review';
      activitySummary = `Job "${jobName}" was completed and moved to review state.`;
      if (params.prLink) {
        activitySummary += ` PR link: ${params.prLink}`;
      }
    }

    await createActivity(
      params.jobId,
      activityName,
      activitySummary,
      currentJob.updatedBy || 'system',
      params.orgId
    );
  }
}


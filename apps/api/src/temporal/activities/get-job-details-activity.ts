import { db, schema } from '../../db/index.js';
import { eq, and } from 'drizzle-orm';
import { logStorage } from '../../services/log-storage.js';
import { websocketManager } from '../../services/websocket-manager.js';

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
  const { jobId, jobVersion, orgId } = params;

  const jobResult = await db
    .select({
      userInput: schema.jobs.userInput,
      generatedName: schema.jobs.generatedName,
      generatedDescription: schema.jobs.generatedDescription,
      repos: schema.jobs.repos,
      orderInQueue: schema.jobs.orderInQueue,
      queueType: schema.jobs.queueType,
    })
    .from(schema.jobs)
    .where(
      and(
        eq(schema.jobs.id, jobId),
        eq(schema.jobs.version, jobVersion),
        eq(schema.jobs.orgId, orgId)
      )
    )
    .limit(1);

  if (!jobResult[0]) {
    return null;
  }

  const job = jobResult[0];

  // Build prompt by appending generatedName, generatedDescription, and userInput.prompt
  const promptParts: string[] = [];

  if (job.generatedName) {
    promptParts.push(job.generatedName);
  }

  if (job.generatedDescription) {
    promptParts.push(job.generatedDescription);
  }

  const userPrompt = (job.userInput as any)?.prompt || '';
  if (userPrompt) {
    promptParts.push(userPrompt);
  }

  const combinedPrompt = promptParts.join('\n\n');

  const result = {
    prompt: combinedPrompt,
    repos: job.repos || undefined,
    orderInQueue: job.orderInQueue,
    queueType: job.queueType as 'rework' | 'backlog' | null,
  };

  // Log workflow start with job details
  const logMessage = {
    level: 'info' as const,
    message: `Workflow execution started for job ${jobId} (v${jobVersion})`,
    timestamp: new Date().toISOString(),
    jobId,
    stage: 'workflow',
  };

  await logStorage.addLog(jobId, jobVersion, orgId, logMessage);
  if (websocketManager.hasSubscribers(jobId)) {
    websocketManager.broadcast(jobId, { type: 'log', data: logMessage });
  }

  // Log job summary
  const summaryLog = {
    level: 'info' as const,
    message: `Job details: prompt="${result.prompt.substring(0, 100)}${
      result.prompt.length > 100 ? '...' : ''
    }", repos=${
      result.repos && result.repos.length > 0 ? result.repos.join(', ') : 'none'
    }`,
    timestamp: new Date().toISOString(),
    jobId,
    stage: 'workflow',
  };

  await logStorage.addLog(jobId, jobVersion, orgId, summaryLog);
  if (websocketManager.hasSubscribers(jobId)) {
    websocketManager.broadcast(jobId, { type: 'log', data: summaryLog });
  }

  return result;
}

import { createTemporalClient } from '../client';

export async function pauseAgentSchedules(params: {
  agentId: string;
}): Promise<{ success: boolean; message: string }> {
  const { agentId } = params;
  const client = await createTemporalClient();
  const scheduleId = `queue-schedule-${agentId}`;
  
  try {
    const handle = client.schedule.getHandle(scheduleId);
    await handle.pause();
    return { success: true, message: `Paused schedule ${scheduleId}` };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('not found') || errorMessage.includes('NotFound')) {
      return { success: true, message: `Schedule ${scheduleId} not found, nothing to pause` };
    }
    console.warn(`Failed to pause schedule ${scheduleId}:`, errorMessage);
    return { success: false, message: `Failed to pause schedule: ${errorMessage}` };
  }
}

export async function pauseHealthCheckSchedule(params: {
  agentId: string;
}): Promise<{ success: boolean; message: string }> {
  const { agentId } = params;
  const client = await createTemporalClient();
  const scheduleId = `health-check-schedule-${agentId}`;
  
  try {
    const handle = client.schedule.getHandle(scheduleId);
    await handle.pause();
    return { success: true, message: `Paused health check schedule ${scheduleId}` };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('not found') || errorMessage.includes('NotFound')) {
      return { success: true, message: `Schedule ${scheduleId} not found, nothing to pause` };
    }
    console.warn(`Failed to pause health check schedule ${scheduleId}:`, errorMessage);
    return { success: false, message: `Failed to pause schedule: ${errorMessage}` };
  }
}


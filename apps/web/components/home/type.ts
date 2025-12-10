import type { JobResponse } from '@/types';

export type LaneId =
  | 'queue'
  | 'in-progress'
  | 'in-review'
  | 'completed'
  | 'failed';

export type LaneDefinition = {
  id: LaneId;
  title: string;
  subtitle: string;
  emptyState: string;
};

export const LANE_DEFINITIONS: LaneDefinition[] = [
  {
    id: 'queue',
    title: 'Queue',
    subtitle: 'BACKLOG',
    emptyState:
      'Nothing waiting here. Add a task and Sia will take it from there.',
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    subtitle: 'ACTIVE AGENT - SIA AGENT',
    emptyState:
      'No active jobs right now. Sia is not working on anything at the moment.',
  },
  {
    id: 'in-review',
    title: 'In Review',
    subtitle: 'AWAITING APPROVAL',
    emptyState: 'Nothing awaiting review',
  },
  {
    id: 'completed',
    title: 'Completed',
    subtitle: 'SHIPPED & STABLE',
    emptyState:
      'Nothing shipped yet. Sia has not completed any tasks at the moment.',
  },
  {
    id: 'failed',
    title: 'Error',
    subtitle: 'Errors',
    emptyState:
      'No failed jobs. Sia has not encountered any errors at the moment.',
  },
];

export const groupJobsByLane = (
  jobList: JobResponse[],
  reworkJobIds: Set<string> = new Set()
): Record<LaneId, JobResponse[]> & {
  rework: JobResponse[];
  backlog: JobResponse[];
} => {
  const rework: JobResponse[] = [];
  const backlog: JobResponse[] = [];
  const grouped: Record<LaneId, JobResponse[]> = {
    queue: [],
    'in-progress': [],
    'in-review': [],
    completed: [],
    failed: [],
  };

  jobList.forEach(job => {
    if (job.status === 'queued') {
      // Use queue_type from job, fallback to reworkJobIds for backwards compatibility
      if (
        job.queue_type === 'rework' ||
        (job.queue_type === undefined && reworkJobIds.has(job.id))
      ) {
        rework.push(job);
      } else {
        backlog.push(job);
      }
    } else if (job.status in grouped) {
      grouped[job.status as LaneId].push(job);
    }
  });

  grouped.queue = [...rework, ...backlog];
  (Object.keys(grouped) as LaneId[]).forEach(laneId => {
    grouped[laneId].sort(
      (a, b) => (a.order_in_queue ?? 0) - (b.order_in_queue ?? 0)
    );
  });

  rework.sort((a, b) => (a.order_in_queue ?? 0) - (b.order_in_queue ?? 0));
  backlog.sort((a, b) => (a.order_in_queue ?? 0) - (b.order_in_queue ?? 0));

  return { ...grouped, rework, backlog };
};

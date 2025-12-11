'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { JobCard } from '@/components/home/job-card';
import { mockAgents } from '@/lib/mockData';
import type { JobResponse } from '@/types';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  DropAnimation,
  MeasuringStrategy,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable';
import { toast } from '@/hooks/use-toast';
import { ArrowUpDown, Filter, MoreHorizontal, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import {
  useReorderJob,
  useQueueStatus,
  useToggleQueue,
  useDeleteJob,
} from '@/hooks/use-jobs';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { LaneColumn } from './lane-column';
import { LANE_DEFINITIONS } from './type';
import { PrLinkDialog } from './pr-link-dialog';
import { QueueSelectionDialog } from './queue-selection-dialog';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';

export type LaneId =
  | 'queue'
  | 'in-progress'
  | 'in-review'
  | 'completed'
  | 'failed';

const DROP_ANIMATION: DropAnimation = {
  duration: 200,
  easing: 'ease-out',
};

const isValidGitHubPRLink = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    // Check if it's a GitHub URL
    if (
      parsedUrl.hostname !== 'github.com' &&
      !parsedUrl.hostname.endsWith('.github.com')
    ) {
      return false;
    }
    // Check if it's a pull request URL (contains /pull/)
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    const pullIndex = pathParts.indexOf('pull');
    // Should have: owner, repo, pull, number
    return (
      pullIndex >= 0 &&
      pullIndex < pathParts.length - 1 &&
      pathParts.length >= 4
    );
  } catch {
    return false;
  }
};

const groupJobsByLane = (
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

  // Combine rework (first) and backlog (second) into queue lane
  grouped.queue = [...rework, ...backlog];
  (Object.keys(grouped) as LaneId[]).forEach(laneId => {
    grouped[laneId].sort(
      (a, b) => (a.order_in_queue ?? 0) - (b.order_in_queue ?? 0)
    );
  });

  // Also sort rework and backlog separately for display
  rework.sort((a, b) => (a.order_in_queue ?? 0) - (b.order_in_queue ?? 0));
  backlog.sort((a, b) => (a.order_in_queue ?? 0) - (b.order_in_queue ?? 0));

  return { ...grouped, rework, backlog };
};

export type JobBoardProps = {
  jobs: JobResponse[];
  onStartJob?: (id: string) => void;
  onCancelJob?: (id: string) => void;
  onSelectReviewJob?: (job: JobResponse) => void;
  onJobMoved?: () => void;
};

export function JobBoard({
  jobs,
  onStartJob,
  onCancelJob,
  onSelectReviewJob,
  onJobMoved,
}: JobBoardProps) {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isPRModalOpen, setIsPRModalOpen] = useState(false);
  const [pendingJobMove, setPendingJobMove] = useState<{
    job: JobResponse;
    targetLane: LaneId;
    targetIndex: number;
  } | null>(null);
  const [prLink, setPrLink] = useState('');
  const [prLinkError, setPrLinkError] = useState('');
  const [reworkJobIds, setReworkJobIds] = useState<Set<string>>(new Set());
  // Controls whether the dedicated "Rework" section is expanded in the Queue lane
  const [showRework, setShowRework] = useState(false);
  const [isQueueSelectionOpen, setIsQueueSelectionOpen] = useState(false);
  const [pendingQueueMove, setPendingQueueMove] = useState<{
    job: JobResponse;
    targetIndex: number;
  } | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    containerId: string;
    index: number;
  } | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pendingDeleteJob, setPendingDeleteJob] = useState<JobResponse | null>(
    null
  );

  const reorderJobMutation = useReorderJob();
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();

  // Queue pause state for rework and backlog queues
  const { data: reworkQueueStatus } = useQueueStatus('rework');
  const { data: backlogQueueStatus } = useQueueStatus('backlog');
  const reworkQueueMutation = useToggleQueue('rework');
  const backlogQueueMutation = useToggleQueue('backlog');
  const deleteJobMutation = useDeleteJob();

  const handleToggleReworkQueue = useCallback(() => {
    const isPaused = reworkQueueStatus?.isPaused ?? false;
    reworkQueueMutation.mutate(isPaused ? 'resume' : 'pause');
  }, [reworkQueueStatus, reworkQueueMutation]);

  const handleToggleBacklogQueue = useCallback(() => {
    const isPaused = backlogQueueStatus?.isPaused ?? false;
    backlogQueueMutation.mutate(isPaused ? 'resume' : 'pause');
  }, [backlogQueueStatus, backlogQueueMutation]);

  const jobsByLane = useMemo(
    () => groupJobsByLane(jobs, reworkJobIds),
    [jobs, reworkJobIds]
  );
  const activeJob = useMemo(
    () =>
      activeJobId ? jobs.find(job => job.id === activeJobId) ?? null : null,
    [jobs, activeJobId]
  ) as JobResponse | null;
  const activeAgent = useMemo(
    () => mockAgents.find(agent => agent.status === 'active') ?? null,
    []
  );

  // Automatically show the Rework section when there are rework jobs
  useEffect(() => {
    const hasReworkJobs = jobs.some(
      job => job.status === 'queued' && job.queue_type === 'rework'
    );
    setShowRework(hasReworkJobs);
  }, [jobs]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag (prevents accidental drags)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveJobId(String(event.active.id));
    setDropIndicator(null);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;

    if (!over) {
      setDropIndicator(null);
      return;
    }

    // Only show drop indicator when dragging within queue lane sections
    const containerId = over.data.current?.sortable?.containerId as
      | string
      | undefined;
    const overIndex = over.data.current?.sortable?.index as number | undefined;

    // Show placeholder for queue sections (rework/backlog)
    if (
      containerId &&
      (containerId === 'queue-rework' || containerId === 'queue-backlog') &&
      overIndex !== undefined
    ) {
      setDropIndicator({ containerId, index: overIndex });
    } else {
      setDropIndicator(null);
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setDropIndicator(null);
      if (!over) {
        setActiveJobId(null);
        return;
      }

      const activeId = String(active.id);

      // Normalize container IDs to handle queue subsections (queue-rework, queue-backlog)
      const normalizeContainerId = (
        containerId: string | undefined
      ): LaneId | undefined => {
        if (!containerId) return undefined;
        // Extract base lane ID from subsection IDs like 'queue-rework' or 'queue-backlog'
        if (containerId.startsWith('queue-')) return 'queue';
        return containerId as LaneId;
      };

      const rawSourceContainer = active.data.current?.sortable?.containerId as
        | string
        | undefined;
      const sourceLane = normalizeContainerId(rawSourceContainer);

      const rawTargetContainer = over.data.current?.sortable?.containerId as
        | string
        | undefined;
      let targetLane = normalizeContainerId(rawTargetContainer);
      if (!targetLane && over.data.current?.type === 'lane') {
        targetLane = over.data.current.status as LaneId;
      }

      if (sourceLane === 'in-progress' && targetLane !== 'in-progress') {
        toast({
          description:
            'Cannot drag the current executing task. Please stop the execution before moving this job.',
        });
        setActiveJobId(null);
        return;
      }

      // Block dragging error jobs to any lane except queue (will go to rework section)
      if (sourceLane === 'failed' && targetLane !== 'queue') {
        toast({
          description:
            'You cannot drag an uncompleted job to these lanes. Please move it only to the Queue.',
        });
        setActiveJobId(null);
        return;
      }

      // Block moving job from queue to in-progress (not supported)
      if (sourceLane === 'queue' && targetLane === 'in-progress') {
        toast({
          description:
            'Cannot move job from queue to in-progress. Queue jobs are processed automatically by the system.',
        });
        setActiveJobId(null);
        return;
      }

      // Block moving any job to failed state (not supported by user)
      if (targetLane === 'failed') {
        toast({
          description:
            'Cannot move job to failed state. Failed status is set automatically by the system when errors occur.',
        });
        setActiveJobId(null);
        return;
      }

      // Block dragging any job to in-progress if one is already executing
      if (
        targetLane === 'in-progress' &&
        jobs.some(job => job.status === 'in-progress')
      ) {
        toast({
          description:
            'User cannot drag the job while one is already executing.',
        });
        setActiveJobId(null);
        return;
      }

      if (!sourceLane || !targetLane) {
        setActiveJobId(null);
        return;
      }

      const overIndex = over.data.current?.sortable?.index;
      const activeJob = jobs.find(job => job.id === activeId);

      if (!activeJob) {
        setActiveJobId(null);
        return;
      }

      // Check if moving from Queue to In Review (completed) or Completed (archived)
      if (
        sourceLane === 'queue' &&
        (targetLane === 'completed' || targetLane === 'in-review')
      ) {
        const targetLaneJobs = jobsByLane[targetLane] ?? [];
        const resolvedIndex =
          overIndex === undefined
            ? targetLaneJobs.length
            : Math.min(overIndex, targetLaneJobs.length);

        // Show modal instead of moving directly
        setPendingJobMove({
          job: activeJob,
          targetLane,
          targetIndex: resolvedIndex,
        });
        setPrLink('');
        setPrLinkError('');
        setIsPRModalOpen(true);
        setActiveJobId(null);
        return;
      }

      // Regular move logic for all other cases
      // Get the appropriate jobs list based on container
      const rawTargetContainerForJobs = over.data.current?.sortable
        ?.containerId as string | undefined;
      let targetLaneJobs = jobsByLane[targetLane] ?? [];

      // For queue lane, use the specific section (rework or backlog) if dragging within it
      if (targetLane === 'queue' && rawTargetContainerForJobs) {
        if (rawTargetContainerForJobs === 'queue-rework') {
          targetLaneJobs = jobsByLane.rework ?? [];
        } else if (rawTargetContainerForJobs === 'queue-backlog') {
          targetLaneJobs = jobsByLane.backlog ?? [];
        }
      }

      // Calculate resolvedIndex - ensure it's within bounds
      // dnd-kit's overIndex already accounts for the removed item when dragging
      const resolvedIndex =
        overIndex === undefined || overIndex > targetLaneJobs.length
          ? targetLaneJobs.length
          : Math.max(0, overIndex);

      // Update rework job IDs
      const updatedReworkJobIds = new Set(reworkJobIds);
      if (sourceLane === 'queue' && targetLane === 'queue') {
        // Moving within queue - determine if moving to rework or backlog section
        // resolvedIndex is the final position in the combined queue array after move
        const reworkCount = jobsByLane.rework.length;
        const wasInRework = reworkJobIds.has(activeId);

        // Check if the target position is in rework section (before current rework count)
        // Note: When moving from rework to backlog or vice versa, resolvedIndex already accounts
        // for the move, so we can compare directly to reworkCount
        const isMovingToReworkSection = resolvedIndex < reworkCount;

        if (wasInRework && !isMovingToReworkSection) {
          // Moving from rework to backlog
          updatedReworkJobIds.delete(activeId);
        } else if (!wasInRework && isMovingToReworkSection) {
          // Moving from backlog to rework
          updatedReworkJobIds.add(activeId);
        }
        // If staying in same section (rework->rework or backlog->backlog), no change needed
      } else if (sourceLane === 'queue' && targetLane !== 'queue') {
        // Moving out of queue - remove from rework if it was there
        updatedReworkJobIds.delete(activeId);
      } else if (sourceLane !== 'queue' && targetLane === 'queue') {
        // Moving into queue - always show queue selection dialog when coming from Errors (failed) lane
        if (sourceLane === 'failed') {
          setPendingQueueMove({
            job: activeJob,
            targetIndex: resolvedIndex,
          });
          setIsQueueSelectionOpen(true);
          setActiveJobId(null);
          return;
        }
        // If rework is hidden, show queue selection dialog
        if (!showRework) {
          setPendingQueueMove({
            job: activeJob,
            targetIndex: resolvedIndex,
          });
          setIsQueueSelectionOpen(true);
          setActiveJobId(null);
          return;
        }
      }

      // Map target lane to job status
      const getStatusForLane = (lane: LaneId): JobResponse['status'] => {
        if (lane === 'queue') return 'queued';
        if (lane === 'completed') return 'completed';
        if (lane === 'in-review') return 'in-review';
        if (lane === 'failed') return 'failed';
        if (lane === 'in-progress') return 'in-progress';
        return 'queued' as JobResponse['status']; // fallback
      };

      const newStatus = getStatusForLane(targetLane);

      // Handle reordering within the same lane
      if (sourceLane === targetLane) {
        const currentJob = jobs.find(job => job.id === activeId);
        const currentPosition = currentJob?.order_in_queue ?? 0;

        let newPosition = resolvedIndex;
        let isMovingBetweenQueues = false;

        if (sourceLane === 'queue') {
          // Get the current queue structure BEFORE updating reworkJobIds
          const currentQueueGroups = groupJobsByLane(jobs, reworkJobIds);

          // For queue lane, calculate position in the combined queue
          const wasInRework = reworkJobIds.has(activeId);
          const isInRework = updatedReworkJobIds.has(activeId);

          // Check if job is moving between Rework and Backlog queues
          // If so, skip the reprioritize API call (only update UI state)
          isMovingBetweenQueues = wasInRework !== isInRework;

          // Get the container ID to determine which section we're in
          const rawTargetContainer = over.data.current?.sortable
            ?.containerId as string | undefined;
          const isTargetRework = rawTargetContainer === 'queue-rework';
          const isTargetBacklog = rawTargetContainer === 'queue-backlog';

          // Get current section lengths (before the move)
          const currentReworkCount = currentQueueGroups.rework.length;

          if (wasInRework && isInRework && isTargetRework) {
            // Moving within rework section only
            // resolvedIndex is relative to rework section (0-based in rework)
            // This is already the correct overall queue position since rework is at the start
            newPosition = resolvedIndex;
          } else if (!wasInRework && !isInRework && isTargetBacklog) {
            // Moving within backlog section only
            // resolvedIndex is relative to backlog section (0-based in backlog)
            // Need to add rework count to get overall queue position
            newPosition = currentReworkCount + resolvedIndex;
          } else if (wasInRework && !isInRework && isTargetBacklog) {
            // Moving from rework to backlog
            // resolvedIndex is relative to backlog, but we need to account for rework jobs
            // Since we're moving out of rework, the rework count decreases by 1
            newPosition = currentReworkCount - 1 + resolvedIndex;
          } else if (!wasInRework && isInRework && isTargetRework) {
            // Moving from backlog to rework
            // resolvedIndex is relative to rework section
            // This is the correct overall queue position
            newPosition = resolvedIndex;
          } else {
            // Fallback: use resolvedIndex directly
            // This handles edge cases where container info might be missing
            newPosition = resolvedIndex;
          }
        } else {
          // For other lanes, position is directly the resolvedIndex
          newPosition = resolvedIndex;
        }

        // If moving between Rework and Backlog queues, only update reworkJobIds and skip API call
        if (isMovingBetweenQueues) {
          // Just update the reworkJobIds state to reflect the queue change
          setReworkJobIds(updatedReworkJobIds);
          setActiveJobId(null);
          return;
        }

        // Check if position actually changed - if not, it's just a click, not a drag
        if (
          currentJob &&
          currentPosition === newPosition &&
          sourceLane === 'queue'
        ) {
          // Position didn't change and it's in queue - this is just a click, not a drag
          // Don't call the API, just clear the active job
          setActiveJobId(null);
          return;
        }

        // Only update UI and call API if position actually changed
        if (currentJob && currentJob.order_in_queue !== newPosition) {
          // Calculate reordered jobs array for optimistic UI update
          const calculateReorderedJobs = (): JobResponse[] => {
            const laneGroups = groupJobsByLane(jobs, updatedReworkJobIds);
            const updatedJobs = [...jobs];

            if (sourceLane === 'queue') {
              // For queue lane, reorder within the queue jobs
              const queueJobs = [...laneGroups.queue];
              const activeIndex = queueJobs.findIndex(
                job => job.id === activeId
              );

              if (activeIndex !== -1 && activeIndex !== newPosition) {
                // Use arrayMove for clean reordering
                const reorderedQueueJobs = arrayMove(
                  queueJobs,
                  activeIndex,
                  newPosition
                );

                // Update order_in_queue for all queue jobs
                reorderedQueueJobs.forEach((job, index) => {
                  const jobIndex = updatedJobs.findIndex(j => j.id === job.id);
                  if (jobIndex !== -1) {
                    updatedJobs[jobIndex] = {
                      ...updatedJobs[jobIndex],
                      order_in_queue: index,
                    };
                  }
                });
              }
            } else {
              // For other lanes, reorder within that lane's jobs
              const laneJobs = [...(laneGroups[sourceLane] ?? [])];
              const activeIndex = laneJobs.findIndex(
                job => job.id === activeId
              );

              if (activeIndex !== -1 && activeIndex !== newPosition) {
                // Use arrayMove for clean reordering
                const reorderedLaneJobs = arrayMove(
                  laneJobs,
                  activeIndex,
                  newPosition
                );

                // Update order_in_queue for all jobs in this lane
                reorderedLaneJobs.forEach((job, index) => {
                  const jobIndex = updatedJobs.findIndex(j => j.id === job.id);
                  if (jobIndex !== -1) {
                    updatedJobs[jobIndex] = {
                      ...updatedJobs[jobIndex],
                      order_in_queue: index,
                    };
                  }
                });
              }
            }

            return updatedJobs;
          };

          // Calculate reordered jobs first
          const reorderedJobs = calculateReorderedJobs();

          // Update query cache and state immediately for smooth transitions
          // dnd-kit will handle the visual transitions automatically
          queryClient.setQueryData<JobResponse[]>(['jobs'], reorderedJobs);
          setReworkJobIds(updatedReworkJobIds);

          // Clear active job after a brief delay to allow transition to complete
          // This ensures smooth animation as other cards shift into position
          setTimeout(() => {
            setActiveJobId(null);
          }, 150);

          // Make API call after transition completes
          // Only call reprioritize API if NOT moving between Rework and Backlog queues
          // The API should only be called when reordering within the same queue section
          if (!isMovingBetweenQueues) {
            setTimeout(() => {
              reorderJobMutation.mutate(
                {
                  jobId: activeId,
                  position: newPosition,
                },
                {
                  onSuccess: () => {
                    onJobMoved?.();
                  },
                }
              );
            }, 200);
          }
        } else {
          setActiveJobId(null);
        }
        return;
      }

      // Handle moving between different lanes
      // Optimistically update the UI immediately to prevent card snap-back
      const updatedJobs = jobs.map(job => {
        if (job.id === activeId) {
          return {
            ...job,
            status: newStatus,
            updated_at: new Date().toISOString(),
          };
        }
        return job;
      });

      // Update query cache and parent state immediately
      queryClient.setQueryData<JobResponse[]>(['jobs'], updatedJobs);
      setReworkJobIds(updatedReworkJobIds);
      setActiveJobId(null);

      // Helper function to get toast message based on status
      const getToastMessage = (status: JobResponse['status']): string => {
        switch (status) {
          case 'in-review':
            return 'Job moved to In Review';
          case 'completed':
            return 'Job marked as Completed';
          case 'in-progress':
            return 'User cannot drag the job while one is already executing.';
          case 'queued':
            return 'Job moved to Queue';
          case 'failed':
            return 'User cannot move a job to the error lane';
          default:
            return 'Job updated successfully';
        }
      };

      // Then make the API call
      try {
        await api.updateJob(activeId, {
          status: newStatus,
          updated_at: new Date().toISOString(),
        });
        // Show toast based on actual API response (success)
        toast({
          description: getToastMessage(newStatus),
        });
        onJobMoved?.();
      } catch (error) {
        console.error('Failed to update job status:', error);
        // Rollback on error - revert to original state
        queryClient.setQueryData<JobResponse[]>(['jobs'], jobs);
        setReworkJobIds(reworkJobIds);
        // Show error toast based on API response (failure)
        toast({
          variant: 'destructive',
          description: 'Failed to update job status. Please try again.',
        });
      }
    },
    [
      jobs,
      jobsByLane,
      reworkJobIds,
      reorderJobMutation,
      onJobMoved,
      queryClient,
      showRework,
    ]
  );

  const handleDragCancel = useCallback(() => {
    setActiveJobId(null);
    setDropIndicator(null);
  }, []);

  const handlePRLinkChange = useCallback((value: string) => {
    setPrLink(value);
    setPrLinkError('');
  }, []);

  const handleUpdatePR = useCallback(async () => {
    if (!pendingJobMove) return;

    const trimmedLink = prLink.trim();
    if (!trimmedLink) {
      setPrLinkError('Please enter a GitHub PR link');
      return;
    }

    if (!isValidGitHubPRLink(trimmedLink)) {
      setPrLinkError(
        'Please enter a valid GitHub PR link (e.g., https://github.com/owner/repo/pull/123)'
      );
      return;
    }

    // Move the job to target lane (In Review or Completed) with the PR link
    // Update rework job IDs - remove from rework if it was there
    const updatedReworkJobIds = new Set(reworkJobIds);
    updatedReworkJobIds.delete(pendingJobMove.job.id);

    // Map target lane to job status
    const getStatusForLane = (lane: LaneId): JobResponse['status'] => {
      if (lane === 'queue') return 'queued';
      if (lane === 'completed') return 'completed';
      if (lane === 'in-review') return 'in-review';
      if (lane === 'failed') return 'failed';
      if (lane === 'in-progress') return 'in-progress';
      return 'queued' as JobResponse['status']; // fallback
    };

    const newStatus = getStatusForLane(pendingJobMove.targetLane as LaneId);

    // Call API to update job with PR link and status
    try {
      await api.updateJob(pendingJobMove.job.id, {
        status: newStatus,
        pr_link: trimmedLink,
        updated_at: new Date().toISOString(),
      });
      toast({
        description:
          newStatus === 'in-review'
            ? 'Job moved to In Review'
            : newStatus === 'completed'
            ? 'Job marked as Completed'
            : 'Job updated successfully',
      });
    } catch (error) {
      console.error('Failed to update job with PR link:', error);
      toast({
        variant: 'destructive',
        description: 'Failed to update job. Please try again.',
      });
      return;
    }

    setReworkJobIds(updatedReworkJobIds);
    onJobMoved?.();
    setIsPRModalOpen(false);
    setPendingJobMove(null);
    setPrLink('');
    setPrLinkError('');
  }, [pendingJobMove, prLink, reworkJobIds, onJobMoved]);

  const handleCancelPR = useCallback(() => {
    // Return job to Queued lane
    if (!pendingJobMove) {
      setIsPRModalOpen(false);
      return;
    }

    // Job is already in Queued, so we just close the modal
    setIsPRModalOpen(false);
    setPendingJobMove(null);
    setPrLink('');
    setPrLinkError('');
  }, [pendingJobMove]);

  const handleQueueSelection = useCallback(
    async (targetQueue: 'rework' | 'backlog') => {
      if (!pendingQueueMove) return;

      const updatedReworkJobIds = new Set(reworkJobIds);
      if (targetQueue === 'rework') {
        updatedReworkJobIds.add(pendingQueueMove.job.id);
        // Show rework section when user selects it
        setShowRework(true);
      }

      // Call API to update job status to queued
      try {
        await api.updateJob(pendingQueueMove.job.id, {
          status: 'queued',
          updated_at: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Failed to update job status:', error);
        toast({
          variant: 'destructive',
          description: 'Failed to update job status. Please try again.',
        });
        return;
      }

      setReworkJobIds(updatedReworkJobIds);
      onJobMoved?.();
      setIsQueueSelectionOpen(false);
      setPendingQueueMove(null);
    },
    [pendingQueueMove, reworkJobIds, onJobMoved]
  );

  const handleDeleteJob = useCallback(
    (jobId: string) => {
      const job = jobs.find(j => j.id === jobId);
      if (job) {
        setPendingDeleteJob(job);
        setIsDeleteDialogOpen(true);
      }
    },
    [jobs]
  );

  const handleConfirmDelete = useCallback(() => {
    if (pendingDeleteJob) {
      deleteJobMutation.mutate(pendingDeleteJob.id);
      setIsDeleteDialogOpen(false);
      setPendingDeleteJob(null);
    }
  }, [pendingDeleteJob, deleteJobMutation]);

  const handleCancelDelete = useCallback(() => {
    setIsDeleteDialogOpen(false);
    setPendingDeleteJob(null);
  }, []);

  const getLaneControls = (laneId: LaneId) => {
    switch (laneId) {
      case 'queue':
        return (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-muted-foreground"
            >
              <Filter className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs text-muted-foreground">All types</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </>
        );
      case 'in-progress':
        return (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-muted-foreground"
            >
              <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs text-muted-foreground">Sort</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </>
        );
      case 'in-review':
        return (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-muted-foreground"
            >
              <Filter className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs text-muted-foreground">Filters</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </>
        );
      case 'completed':
        return (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-muted-foreground"
            >
              <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs text-muted-foreground">Sort</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      collisionDetection={closestCenter}
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.WhileDragging,
        },
        draggable: {
          measure: node => node.getBoundingClientRect(),
        },
      }}
    >
      <div className="h-full w-full overflow-x-auto overflow-y-hidden pb-2 grid grid-cols-5">
        {/* <div className="flex-1 overflow-y-auto"> */}
        <div className="flex gap-2 h-full max-w-[300px] min-w-[200px]">
          {LANE_DEFINITIONS.map(lane => {
            const handleExecuteRework =
              lane.id === 'queue' && onStartJob
                ? () => {
                    const firstReworkJob = jobsByLane.rework[0];
                    if (firstReworkJob) {
                      onStartJob(firstReworkJob.id);
                    }
                  }
                : undefined;

            const handleExecuteBacklog =
              lane.id === 'queue' && onStartJob
                ? () => {
                    const firstBacklogJob = jobsByLane.backlog[0];
                    if (firstBacklogJob) {
                      onStartJob(firstBacklogJob.id);
                    }
                  }
                : undefined;

            return (
              <LaneColumn
                key={lane.id}
                lane={lane}
                jobs={jobsByLane[lane.id]}
                reworkJobs={lane.id === 'queue' ? jobsByLane.rework : undefined}
                backlogJobs={
                  lane.id === 'queue' ? jobsByLane.backlog : undefined
                }
                onExecuteRework={handleExecuteRework}
                onExecuteBacklog={handleExecuteBacklog}
                reworkQueuePaused={
                  lane.id === 'queue' ? reworkQueueStatus?.isPaused : undefined
                }
                backlogQueuePaused={
                  lane.id === 'queue' ? backlogQueueStatus?.isPaused : undefined
                }
                onToggleReworkQueue={
                  lane.id === 'queue' ? handleToggleReworkQueue : undefined
                }
                onToggleBacklogQueue={
                  lane.id === 'queue' ? handleToggleBacklogQueue : undefined
                }
                showRework={showRework}
                activeAgent={
                  lane.id === 'in-progress' ? activeAgent : undefined
                }
                theme={resolvedTheme}
                dropIndicator={lane.id === 'queue' ? dropIndicator : null}
                activeJobId={activeJobId}
                controls={getLaneControls(lane.id)}
                renderJob={(job, helpers) => (
                  <JobCard
                    key={`${lane.id}-${job.id}`}
                    job={job}
                    onStart={
                      lane.id === 'queue'
                        ? undefined
                        : lane.id === 'in-progress'
                        ? onStartJob
                        : onStartJob
                    }
                    onCancel={
                      lane.id === 'queue'
                        ? undefined
                        : lane.id === 'in-progress'
                        ? onCancelJob
                        : undefined
                    }
                    onDelete={
                      lane.id !== 'in-progress' ? handleDeleteJob : undefined
                    }
                    hideActions={lane.id === 'queue'}
                    isDraggable={lane.id === 'queue'}
                    isClickable={true}
                    onDisableLaneAnimation={helpers?.disableAnimatedBorder}
                    onEnableLaneAnimation={helpers?.enableAnimatedBorder}
                    isAnimationDisabled={helpers?.isAnimationDisabled}
                    onCardClick={undefined}
                  />
                )}
              />
            );
          })}
        </div>
        {/* </div> */}
      </div>
      <DragOverlay dropAnimation={DROP_ANIMATION}>
        {activeJob ? (
          <div className="rotate-2 scale-105 [&_*]:!shadow-none">
            <SortableContext items={[activeJob.id]}>
              <JobCard
                job={activeJob}
                isClickable={false}
                isDraggable={false}
              />
            </SortableContext>
          </div>
        ) : null}
      </DragOverlay>
      <PrLinkDialog
        open={isPRModalOpen}
        pendingJobMove={pendingJobMove}
        prLink={prLink}
        prLinkError={prLinkError}
        onChange={handlePRLinkChange}
        onSubmit={handleUpdatePR}
        onCancel={handleCancelPR}
      />
      <QueueSelectionDialog
        open={isQueueSelectionOpen}
        pendingQueueMove={pendingQueueMove}
        onSelect={handleQueueSelection}
        onClose={() => {
          setIsQueueSelectionOpen(false);
          setPendingQueueMove(null);
        }}
      />
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        job={pendingDeleteJob}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </DndContext>
  );
}

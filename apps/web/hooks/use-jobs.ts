import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api, startJobExecution } from '@/lib/api';
import type { JobResponse } from '@/types';
import { toast } from '@/hooks/use-toast';
/**
 * Hook to fetch all jobs from the API with authentication
 */
export function useJobs() {
  const queryClient = useQueryClient();

  const jobsQuery = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      return await api.getJobs();
    },
    // Enable lightweight polling so job status changes propagate to the board
    refetchInterval: 10000, // Refetch every 10 seconds for live updates
    staleTime: 1000, // Consider data stale after 1 second
  });

  // Sync individual job caches when jobs list updates
  // Preserve logs and other detailed data that might exist in the individual job cache
  useEffect(() => {
    if (jobsQuery.data) {
      jobsQuery.data.forEach(jobFromList => {
        const existingJob = queryClient.getQueryData<JobResponse>([
          'job',
          jobFromList.id,
        ]);

        if (existingJob) {
          // Check if version has changed - if so, clear logs (new version = new execution)
          const versionChanged = existingJob.version !== jobFromList.version;

          // Merge: Update only frequently changing fields from jobs list
          // ALWAYS preserve logs and other detailed data from existing cache
          // The jobs list might not include logs or might have incomplete/null logs
          // BUT: Clear logs if version changed (new version = new execution)
          const mergedJob: JobResponse = {
            ...existingJob, // Start with existing cache to preserve all detailed data
            // Update version and other fields that change frequently
            version: jobFromList.version, // Always update version
            status: jobFromList.status,
            updated_at: jobFromList.updated_at,
            order_in_queue: jobFromList.order_in_queue,
            queue_type: jobFromList.queue_type,
            priority: jobFromList.priority,
            // If version changed, use jobs list logs (which will be empty/null for new version)
            // If version didn't change, preserve existing logs if they exist, otherwise use jobs list logs
            // This ensures logs persist when status changes (e.g., in-progress -> failed)
            code_generation_logs: versionChanged
              ? jobFromList.code_generation_logs
              : existingJob.code_generation_logs != null
              ? existingJob.code_generation_logs
              : jobFromList.code_generation_logs,
            code_verification_logs: versionChanged
              ? jobFromList.code_verification_logs
              : existingJob.code_verification_logs != null
              ? existingJob.code_verification_logs
              : jobFromList.code_verification_logs,
          };
          queryClient.setQueryData<JobResponse>(
            ['job', jobFromList.id],
            mergedJob
          );
        } else {
          // No existing cache, just set the job from the list
          queryClient.setQueryData<JobResponse>(
            ['job', jobFromList.id],
            jobFromList
          );
        }
      });
    }
  }, [jobsQuery.data, queryClient]);

  return jobsQuery;
}

/**
 * Hook to fetch a single job by ID with authentication
 * First tries to get the job from the jobs list cache, then fetches if not found
 */
export function useJob(id: string) {
  // const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      // First check if job exists in jobs list cache
      // const jobs = queryClient.getQueryData<JobResponse[]>(['jobs']);
      // if (jobs) {
      //   const jobFromCache = jobs.find(job => job.id === id);
      //   if (jobFromCache) {
      //     return jobFromCache;
      //   }
      // }

      // If not found in cache, fetch from API
      const job = await api.getJob(id);
      if (!job) {
        throw new Error(`Job with id ${id} not found`);
      }
      return job;
    },
    enabled: !!id, // Only run query if id is provided
    // No polling - relies on useJobs() polling to update the cache
  });
}

/**
 * Hook to start job execution
 * This mutation will trigger the backend to execute the job
 */
export function useStartJobExecution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      return await startJobExecution(jobId);
    },
    // Optimistically mark the job as in-progress so the board updates immediately
    onMutate: async (jobId: string) => {
      await queryClient.cancelQueries({ queryKey: ['jobs'] });

      const previousJobs = queryClient.getQueryData<JobResponse[]>(['jobs']);

      if (previousJobs) {
        const updatedJobs: JobResponse[] = previousJobs.map(job => {
          if (job.id !== jobId) return job;

          return {
            ...job,
            status: 'in-progress' as JobResponse['status'],
            // Clear queue info locally – backend will be source of truth after refetch
            queue_type: undefined,
            order_in_queue: -1,
            updated_at: new Date().toISOString(),
          };
        });

        queryClient.setQueryData<JobResponse[]>(['jobs'], updatedJobs);
      }

      return { previousJobs };
    },
    onError: (_error, _jobId, context) => {
      // Roll back to previous jobs on error
      if (context?.previousJobs) {
        queryClient.setQueryData<JobResponse[]>(['jobs'], context.previousJobs);
      }
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
    onSuccess: (_data, jobId) => {
      // Invalidate and refetch jobs to get the authoritative status from backend
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
    },
  });
}

/**
 * Hook to reorder a job within the same lane
 */
export function useReorderJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      jobId,
      position,
    }: {
      jobId: string;
      position: number;
    }) => {
      return await api.reprioritizeJob(jobId, position);
    },
    onSuccess: (data, { jobId }) => {
      // Show success message in toast
      if (data?.message) {
        if (!data.message.includes('already at the requested position')) {
          toast({
            description: data.message,
          });
        }
      } else {
        toast({
          variant: 'destructive',
          description: 'Only queued jobs can be reprioritized',
        });
      }

      // Delay invalidation to let optimistic UI update be visible
      // The polling refetch (every 5 seconds) will also sync the data
      setTimeout(() => {
        // queryClient.invalidateQueries({ queryKey: ['jobs'] })
        queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      }, 500);
    },
    onError: error => {
      let errorMessage = 'Failed to reorder job. Please try again.';
      if (typeof error === 'object' && error !== null) {
        const maybeMessage = (error as { message?: string }).message;
        const maybeError = (error as { error?: string }).error;
        errorMessage = maybeMessage || maybeError || errorMessage;
      }
      toast({
        variant: 'destructive',
        description: errorMessage,
      });
      console.error('Failed to reorder job:', error);
    },
  });
}

/**
 * Hook to get queue pause state
 */
export function useQueueStatus(queueType: 'rework' | 'backlog') {
  return useQuery({
    queryKey: ['queueStatus', queueType],
    queryFn: async () => {
      return await api.getQueueStatus(queueType);
    },
    // refetchInterval: 5000,
    staleTime: 1000,
  });
}

/**
 * Hook to pause/resume a queue
 */
export function useToggleQueue(queueType: 'rework' | 'backlog') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (action: 'pause' | 'resume') => {
      if (action === 'pause') {
        return await api.pauseQueue(queueType);
      }
      return await api.resumeQueue(queueType);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queueStatus', queueType] });
    },
    onError: error => {
      console.error('Failed to toggle queue state:', error);
      toast({
        variant: 'destructive',
        description: 'Failed to update queue state. Please try again.',
      });
    },
  });
}

/**
 * Hook to delete a job
 */
export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      return await api.deleteJob(jobId);
    },
    onMutate: async (jobId: string) => {
      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['jobs'] });

      // Snapshot the previous value
      const previousJobs = queryClient.getQueryData<JobResponse[]>(['jobs']);

      // Optimistically remove the job from the list
      if (previousJobs) {
        const updatedJobs = previousJobs.filter(job => job.id !== jobId);
        queryClient.setQueryData<JobResponse[]>(['jobs'], updatedJobs);
      }

      return { previousJobs };
    },
    onError: (_error, _jobId, context) => {
      // Rollback to previous jobs on error
      if (context?.previousJobs) {
        queryClient.setQueryData<JobResponse[]>(['jobs'], context.previousJobs);
      }
      toast({
        variant: 'destructive',
        description: 'Failed to delete job. Please try again.',
      });
    },
    onSuccess: (_data, jobId) => {
      // Invalidate and refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      toast({
        description: 'Job deleted successfully',
      });
    },
  });
}

'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useJob } from '@/hooks/use-jobs';
import { JobDetail } from '@/components/jobs/job-detail';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RotateCw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { acceptanceStyles } from '@/components/jobs/job-constants';
import { cn } from '@/lib/utils';

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [isRetryFormOpen, setIsRetryFormOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const jobId = useMemo(() => {
    if (!params?.id) return '';
    return Array.isArray(params.id) ? params.id[0] : params.id;
  }, [params]);

  const { data: job, isLoading, isError } = useJob(jobId);

  const cancelJobMutation = useMutation({
    mutationFn: async () => {
      if (!job) return;
      return api.updateJobStatus(job.id, 'failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({
        title: 'Job cancelled',
        description: 'The job has been cancelled successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Cancel failed',
        description: 'Unable to cancel the job. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleRetryOpen = () => setIsRetryFormOpen(true);
  const handleRetryCancel = () => setIsRetryFormOpen(false);
  const handleRetrySuccess = () => {
    setIsRetryFormOpen(false);
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading job details…</p>
      </div>
    );
  }

  if (isError || !job) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">
          {isError
            ? 'Unable to load this job from the API.'
            : 'Job not found in the current workspace.'}
        </p>
        <Button onClick={() => router.push('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-border flex items-center justify-between px-6 py-3">
        <div className="flex items-center justify-between gap-5">
          <span className="text-base font-semibold">Job Details</span>
          <div className="flex flex-wrap gap-2">
            <Badge className="capitalize">{job?.status}</Badge>
            <Badge variant="secondary" className="capitalize">
              {job?.priority}
            </Badge>
            {job?.status === 'in-review' && (
              <Badge
                className={cn(
                  'capitalize',
                  acceptanceStyles[
                    job?.user_acceptance_status as keyof typeof acceptanceStyles
                  ]
                )}
              >
                {job?.user_acceptance_status.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(job?.status === 'failed' || job?.status === 'completed') &&
            !isRetryFormOpen && (
              <Button size="sm" onClick={handleRetryOpen}>
                <RotateCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            )}
          {(job?.status === 'queued' || job?.status === 'in-progress') &&
            !isRetryFormOpen && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => cancelJobMutation.mutate()}
                disabled={cancelJobMutation.isPending}
              >
                Cancel job
              </Button>
            )}
        </div>
      </div>

      <JobDetail
        job={job}
        isLoading={isLoading}
        onClose={() => router.push('/')}
        isModalOpen
        isRetryFormOpen={isRetryFormOpen}
        onRetryCancel={handleRetryCancel}
        onRetrySuccess={handleRetrySuccess}
      />
    </div>
  );
}

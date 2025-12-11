'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useJob } from '@/hooks/use-jobs';
import { JobDetail } from './job-detail';
import { Button } from '@/components/ui/button';
import { RotateCw, Trash } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { acceptanceStyles } from './job-constants';
import { cn } from '@/lib/utils';
import { DeleteConfirmationDialog } from '../home/delete-confirmation-dialog';

interface JobDetailModalProps {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JobDetailModal({
  jobId,
  open,
  onOpenChange,
}: JobDetailModalProps) {
  const { data: job, isLoading, isError } = useJob(jobId);
  const [isRetryFormOpen, setIsRetryFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      await api.deleteJob(jobId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      toast({
        title: 'Job deleted',
        description: 'The job has been successfully deleted.',
      });
      setIsDeleteDialogOpen(false);
      onOpenChange(false);
    },
    onError: error => {
      console.error('Failed to delete job:', error);
      toast({
        title: 'Deletion failed',
        description: 'Unable to delete the job. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleDeleteJobConfirm = () => {
    if (job?.id) {
      deleteJobMutation.mutate(job.id);
    }
  };

  const handleDeleteJobCancel = () => {
    setIsDeleteDialogOpen(false);
  };

  const handleRetryOpen = () => setIsRetryFormOpen(true);
  const handleRetryCancel = () => setIsRetryFormOpen(false);
  const handleRetrySuccess = () => setIsRetryFormOpen(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[70%] h-[90vh] p-0">
        <DialogTitle className="text-base font-semibold  text-foreground border-b border-border  flex items-center justify-between px-6 py-3">
          <div className="flex items-center justify-between gap-5">
            <span>Job Details</span>
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
          <div className="flex flex-wrap items-center gap-2 pr-10">
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
                  {/* <X className="h-4 w-4 mr-2" /> */}
                  Cancel job
                </Button>
              )}
            {!isRetryFormOpen && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash className="h-4 w-4 mr-2" />
                Delete Job
              </Button>
            )}
          </div>
        </DialogTitle>
        <div className="p-3 overflow-auto max-h-[90vh] mt-[-10px]">
          {isLoading ? (
            <div className="flex h-[60vh] items-center justify-center">
              <p className="text-muted-foreground">Loading job details…</p>
            </div>
          ) : isError || !job ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {isError
                  ? 'Unable to load this job from the API.'
                  : 'Job not found in the current workspace.'}
              </p>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          ) : (
            <JobDetail
              job={job}
              isLoading={isLoading}
              onClose={() => onOpenChange(false)}
              isModalOpen={open}
              isRetryFormOpen={isRetryFormOpen}
              onRetryCancel={handleRetryCancel}
              onRetrySuccess={handleRetrySuccess}
            />
          )}
        </div>
      </DialogContent>
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        job={job || null}
        onConfirm={handleDeleteJobConfirm}
        onCancel={handleDeleteJobCancel}
      />
    </Dialog>
  );
}

'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useJob } from '@/hooks/use-jobs';
import { JobDetail } from './job-detail';
import { Button } from '@/components/ui/button';
import { RotateCw, Trash, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

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
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
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
      setShowDeleteConfirmation(false);
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
    setShowDeleteConfirmation(false);
  };

  const handleRetryOpen = () => setIsRetryFormOpen(true);
  const handleRetryCancel = () => setIsRetryFormOpen(false);
  const handleRetrySuccess = () => {
    setIsRetryFormOpen(false);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={isOpen => {
        setShowDeleteConfirmation(false);
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="max-w-[80%] max-h-[90vh] p-0 rounded-3xl">
        <DialogTitle className="text-base font-semibold text-foreground p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-3xl px-5 py-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col">
                <span className="text-lg font-semibold text-foreground">
                  Job details
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {job?.status && (
                  <Badge
                    variant="outline"
                    className="h-8 rounded-full border-primary/40 bg-primary/5 px-3 text-sm font-semibold text-primary capitalize"
                  >
                    {job.status}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pr-14">
              {(job?.status === 'failed' || job?.status === 'completed') &&
                !isRetryFormOpen && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleRetryOpen}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRetryOpen();
                      }
                    }}
                    className="h-8"
                  >
                    <RotateCw className="h-4 w-4 mr-1" />
                    <p className="text-xs font-medium text-foreground">Retry</p>
                  </Button>
                )}
              {job?.status === 'in-progress' && !isRetryFormOpen && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => cancelJobMutation.mutate()}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      cancelJobMutation.mutate();
                    }
                  }}
                  disabled={cancelJobMutation.isPending}
                  className="h-8 border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4 " />
                  <p className="text-xs  font-medium  text-destructive">
                    Cancel job
                  </p>
                </Button>
              )}
              {!isRetryFormOpen && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => setShowDeleteConfirmation(true)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowDeleteConfirmation(true);
                    }
                  }}
                  className="h-8 text-white"
                >
                  <Trash className="h-4 w-4 " />
                  <p className="text-xs font-medium">Delete job</p>
                </Button>
              )}
            </div>
          </div>
        </DialogTitle>
        <div className="p-5 mt-[-10px]">
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
              showDeleteConfirmation={showDeleteConfirmation}
              onDeleteConfirm={handleDeleteJobConfirm}
              onDeleteCancel={handleDeleteJobCancel}
              isDeleting={deleteJobMutation.isPending}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

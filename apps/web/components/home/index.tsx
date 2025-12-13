'use client';

import { Button } from '@/components/ui/button';
import { JobBoard } from '@/components/home/job-board';
import type { JobResponse } from '@sia/models';
import { useToast } from '@/hooks/use-toast';
import { useJobs, useStartJobExecution } from '@/hooks/use-jobs';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function Index() {
  const { toast } = useToast();
  const { data: jobs = [], isLoading, isError, error } = useJobs();

  // Use the job execution hook
  const startJobMutation = useStartJobExecution();

  const handleStartJob = (id: string) => {
    startJobMutation.mutate(id, {
      onSuccess: data => {
        if (data?.message) {
          toast({
            description: data.message,
          });
        }
      },
      onError: error => {
        const errorMessage = error ? error.message : 'An error occurred';
        toast({
          description: errorMessage,
          variant: 'destructive',
        });
      },
    });
  };

  const handleCancelJob = (id: string) => {
    // TODO: Implement API mutation to cancel job
    // For now, just show a toast
    toast({
      title: 'Job cancelled',
      description: 'Execution has been cancelled',
    });
  };

  const handleSelectReviewJob = (job: JobResponse) => {
    // TODO: Implement review job selection logic
    console.log('Selected review job:', job);
  };

  const handleJobMoved = () => {
    // toast({
    //   title: 'Job updated',
    //   description: 'Job destination has been updated',
    // })
    console.log('Job moved');
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-full w-full mx-auto overflow-hidden">
        <div className="flex flex-col h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">Loading jobs...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (isError) {
    return (
      <div className="h-full w-full mx-auto overflow-hidden">
        <div className="flex flex-col h-full items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-destructive mb-2">
                Error loading jobs
              </h3>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error
                  ? error.message
                  : 'An unexpected error occurred'}
              </p>
              <Button
                onClick={() => window.location.reload()}
                className="mt-4"
                variant="outline"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full mx-auto overflow-hidden space-y-6">
      <div className="flex-1 min-h-0 overflow-hidden mx-auto">
        <JobBoard
          jobs={jobs}
          onStartJob={handleStartJob}
          onCancelJob={handleCancelJob}
          onSelectReviewJob={handleSelectReviewJob}
          onJobMoved={handleJobMoved}
        />
      </div>
    </div>
  );
}

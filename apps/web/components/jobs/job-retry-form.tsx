'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Check, X } from 'lucide-react';

interface JobRetryFormProps {
  jobId: string;
  currentComments: Array<{
    file_name: string;
    line_no: number;
    prompt: string;
  }>;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function JobRetryForm({
  jobId,
  currentComments,
  onSuccess,
  onCancel,
}: JobRetryFormProps) {
  const [comment, setComment] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const retryMutation = useMutation({
    mutationFn: async ({ comment }: { comment: string }) => {
      const newCommentObj = {
        file_name: '',
        line_no: 0,
        prompt: comment,
      };
      const result = await api.updateJob(jobId, {
        status: 'queued',
        queue_type: 'rework',
        user_comments: [...currentComments, newCommentObj],
      });
      if (!result) {
        throw new Error('Failed to retry job');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setComment('');
      toast({
        title: 'Job queued for retry',
        description: 'The job has been added to the rework queue.',
      });
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: 'Retry failed',
        description: 'Unable to retry the job. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    retryMutation.mutate({ comment: comment.trim() });
  };

  const handleCancel = () => {
    setComment('');
    onCancel?.();
  };

  return (
    <div className="w-full space-y-4 mt-4 pt-4">
      <div className="space-y-2">
        <label htmlFor="retry_comment" className="text-sm font-medium">
          Retry Job
        </label>
        <p className="text-xs text-muted-foreground">
          Add a comment about why you&apos;re retrying this job. The job will be
          added to the rework queue.
        </p>
        <Textarea
          id="retry_comment"
          placeholder="Enter your comment here (optional)..."
          value={comment}
          onChange={e => setComment(e.target.value)}
          className="min-h-[50px] resize-none"
          autoFocus
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={retryMutation.isPending}
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={retryMutation.isPending}>
          <Check className="h-4 w-4 mr-2" />
          {retryMutation.isPending ? 'Retrying...' : 'Retry Job'}
        </Button>
      </div>
    </div>
  );
}

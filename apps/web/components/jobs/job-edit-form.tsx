'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthInfo } from '@propelauth/react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ClipboardList, Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { JobResponse } from '@/types';

interface JobEditFormProps {
  job: JobResponse;
  editForm: {
    generated_name: string;
    generated_description: string;
    user_input_prompt: string;
    order_in_queue: string;
    repo_name: string;
  };
  userInputSource?: string;
  availableRepos: Array<{ id: string; name: string; url: string }>;
  titleError: string;
  onEditFormChange: (field: string, value: string) => void;
  onTitleErrorChange: (error: string) => void;
  onSuccess: () => void;
  onCancel: () => void;
}

export function JobEditForm({
  job,
  editForm,
  userInputSource,
  availableRepos,
  titleError,
  onEditFormChange,
  onTitleErrorChange,
  onSuccess,
  onCancel,
}: JobEditFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const authInfo = useAuthInfo();

  const updateJobMutation = useMutation({
    mutationFn: async (updates: {
      generated_name?: string;
      generated_description?: string;
      user_input?: {
        source: 'slack' | 'discord' | 'mobile' | 'gh-issues';
        prompt: string;
      };
      order_in_queue?: number;
      repo?: string;
    }) => {
      const userId = authInfo.user?.userId || 'sia-system';
      const userName =
        authInfo.user?.firstName && authInfo.user?.lastName
          ? `${authInfo.user.firstName} ${authInfo.user.lastName}`
          : authInfo.user?.email?.split('@')[0] || 'User';
      const updatedBy = `${userName} (${userId})`;

      const result = await api.updateJob(job.id, {
        ...updates,
        updated_by: updatedBy,
      } as Parameters<typeof api.updateJob>[1]);
      if (!result) {
        throw new Error('Failed to update job');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({
        title: 'Job updated',
        description: 'The job has been updated successfully.',
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: 'Update failed',
        description: 'Unable to update the job. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    // Validate job title is mandatory
    if (!editForm.generated_name || !editForm.generated_name.trim()) {
      onTitleErrorChange('Job title is mandatory.');
      return;
    }

    // Clear error if validation passes
    onTitleErrorChange('');

    const updates: {
      generated_name?: string;
      generated_description?: string;
      user_input?: {
        source: 'slack' | 'discord' | 'mobile' | 'gh-issues';
        prompt: string;
      };
      order_in_queue?: number;
      repo?: string;
    } = {};

    if (editForm.generated_name !== job?.generated_name) {
      updates.generated_name = editForm.generated_name;
    }
    if (editForm.generated_description !== job?.generated_description) {
      updates.generated_description = editForm.generated_description;
    }
    if (editForm.user_input_prompt !== job?.user_input?.prompt) {
      updates.user_input = {
        source: (job?.user_input?.source || 'mobile') as
          | 'slack'
          | 'discord'
          | 'mobile'
          | 'gh-issues',
        prompt: editForm.user_input_prompt,
      };
    }
    if (editForm.order_in_queue !== job?.order_in_queue?.toString()) {
      const orderValue = parseInt(editForm.order_in_queue, 10);
      if (!isNaN(orderValue)) {
        updates.order_in_queue = orderValue;
      }
    }
    if (editForm.repo_name !== job?.repo_name) {
      // Find the repo ID from the selected repo name
      const selectedRepo = availableRepos.find(
        repo => repo.name === editForm.repo_name
      );
      if (selectedRepo) {
        updates.repo = selectedRepo.id;
      } else if (!editForm.repo_name) {
        // If no repo selected, clear it
        updates.repo = undefined;
      }
    }

    if (Object.keys(updates).length === 0) {
      toast({
        title: 'No changes',
        description: 'No changes were made to the job.',
      });
      return;
    }

    updateJobMutation.mutate(updates);
  };

  return (
    <div className="w-full space-y-4 mt-4 pt-4">
      <div className="space-y-2">
        <label htmlFor="generated_description" className="text-sm font-medium">
          Summary
        </label>
        <Textarea
          id="generated_description"
          value={editForm.generated_description}
          onChange={e =>
            onEditFormChange('generated_description', e.target.value)
          }
          placeholder="Job summary"
          className="min-h-[100px] resize-none"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ClipboardList className="h-4 w-4" />
          User Input
          {userInputSource && (
            <span className="text-xs text-muted-foreground font-normal">
              (Source: {userInputSource})
            </span>
          )}
        </div>
        <Textarea
          id="user_input_prompt"
          value={editForm.user_input_prompt}
          onChange={e => onEditFormChange('user_input_prompt', e.target.value)}
          placeholder="User input prompt"
          className="min-h-[100px] resize-none"
        />
      </div>
      <div className="flex gap-2 pt-4">
        <Button onClick={handleSubmit} disabled={updateJobMutation.isPending}>
          <Check className="h-4 w-4 mr-2" />
          {updateJobMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={updateJobMutation.isPending}
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

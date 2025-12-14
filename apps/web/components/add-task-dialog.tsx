'use client';

import { useEffect, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuthInfo } from '@propelauth/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { MultiSelect } from './ui/multi-select';
import { api, type Repo } from '@/lib/api';

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTaskDialog({ open, onOpenChange }: AddTaskDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const authInfo = useAuthInfo();

  const [prompt, setPrompt] = useState('');
  const [userInstructions, setUserInstructions] = useState('');
  const [buildCommands, setBuildCommands] = useState('');
  const [verificationCommands, setVerificationCommands] = useState('');
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([]);
  const [availableRepos, setAvailableRepos] = useState<Repo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);

  const createJobMutation = useMutation({
    mutationFn: async (userPrompt: string) => {
      return await api.createJob({
        user_input: {
          source: 'mobile',
          prompt: userPrompt,
          sourceMetadata: null,
        },
        repos: selectedRepoIds.length > 0 ? selectedRepoIds : undefined,
        created_by: authInfo.user?.userId || 'unknown',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({
        title: 'Task added',
        description: 'Your task has been submitted to the Sia agent',
      });
      setPrompt('');
      setUserInstructions('');
      setBuildCommands('');
      setVerificationCommands('');
      setSelectedRepoIds([]);
      onOpenChange(false);
    },
    onError: error => {
      const errorMessage = error
        ? (error as Error).message
        : 'An error occurred';
      toast({
        title: 'Failed to add task',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (open) {
      setIsLoadingRepos(true);
      api
        .getAllRepos()
        .then(repos => setAvailableRepos(repos))
        .catch(() => {
          toast({
            title: 'Failed to load repos',
            description:
              'Unable to load repositories. You can still create a job without selecting a repo.',
            variant: 'destructive',
          });
        })
        .finally(() => setIsLoadingRepos(false));
    }
  }, [open, toast]);

  const handleAddTask = () => {
    if (prompt.trim()) {
      createJobMutation.mutate(prompt.trim());
    }
  };

  const handleCancel = () => {
    setPrompt('');
    setUserInstructions('');
    setBuildCommands('');
    setVerificationCommands('');
    setSelectedRepoIds([]);
    onOpenChange(false);
  };

  // Convert repos to MultiSelect options
  const repoOptions = availableRepos.map(repo => ({
    label: repo.name,
    value: repo.id,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
          <DialogDescription>
            Enter a prompt for the Sia agent to execute
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="prompt-input" className="text-sm font-medium">
              Prompt
            </label>
            <Textarea
              id="prompt-input"
              placeholder="Enter your prompt here..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="user-instructions-input"
              className="text-sm font-medium"
            >
              User Instructions
            </label>
            <Textarea
              id="user-instructions-input"
              placeholder="Enter user instructions here..."
              value={userInstructions}
              onChange={e => setUserInstructions(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="repo-select" className="text-sm font-medium">
              Repository (Optional)
            </label>
            <MultiSelect
              options={repoOptions}
              selected={selectedRepoIds}
              onChange={setSelectedRepoIds}
              placeholder={
                isLoadingRepos
                  ? 'Loading repositories...'
                  : availableRepos.length === 0
                  ? 'No repositories available'
                  : 'Select repositories...'
              }
              disabled={isLoadingRepos}
              className="w-full h-14"
            />
            {availableRepos.length === 0 && !isLoadingRepos && (
              <p className="text-xs text-muted-foreground">
                No repositories configured. Connect a GitHub provider to add
                repositories.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label
              htmlFor="build-commands-input"
              className="text-sm font-medium"
            >
              Build Commands{' '}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="build-commands-input"
              placeholder="Enter build commands (e.g., npm run build)"
              value={buildCommands}
              onChange={e => setBuildCommands(e.target.value)}
              className="px-4 py-3 h-14"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="verification-commands-input"
              className="text-sm font-medium"
            >
              Verification Commands{' '}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="verification-commands-input"
              placeholder="Enter verification commands (e.g., npm test)"
              value={verificationCommands}
              onChange={e => setVerificationCommands(e.target.value)}
              className="px-4 py-4 h-14"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={createJobMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddTask}
            disabled={!prompt.trim() || createJobMutation.isPending}
          >
            {createJobMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Add
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

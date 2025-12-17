'use client';

import { useEffect, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuthInfo } from '@propelauth/react';
// import { useDropzone } from 'react-dropzone';
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
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([]);
  const [availableRepos, setAvailableRepos] = useState<Repo[]>([]);
  // const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [repoBuildCommands, setRepoBuildCommands] = useState<
    Record<string, string>
  >({});
  const [repoVerificationCommands, setRepoVerificationCommands] = useState<
    Record<string, string>
  >({});
  const [repoSavedBuildCommands, setRepoSavedBuildCommands] = useState<
    Record<string, string>
  >({});
  const [repoSavedVerificationCommands, setRepoSavedVerificationCommands] =
    useState<Record<string, string>>({});
  const [dirtyRepos, setDirtyRepos] = useState<Set<string>>(new Set());
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [configuringRepoId, setConfiguringRepoId] = useState<string | null>(
    null
  );

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
      setSelectedRepoIds([]);
      // setUploadedFiles([]);
      setRepoBuildCommands({});
      setRepoVerificationCommands({});
      setRepoSavedBuildCommands({});
      setRepoSavedVerificationCommands({});
      setDirtyRepos(new Set());
      setConfiguringRepoId(null);
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
    setSelectedRepoIds([]);
    // setUploadedFiles([]);
    setRepoBuildCommands({});
    setRepoVerificationCommands({});
    setRepoSavedBuildCommands({});
    setRepoSavedVerificationCommands({});
    setDirtyRepos(new Set());
    setConfiguringRepoId(null);
    onOpenChange(false);
  };

  useEffect(() => {
    // Remove repo-specific data when repos are deselected
    setRepoBuildCommands(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => {
        if (!selectedRepoIds.includes(id)) {
          delete next[id];
        }
      });
      return next;
    });
    setRepoVerificationCommands(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => {
        if (!selectedRepoIds.includes(id)) {
          delete next[id];
        }
      });
      return next;
    });
    setRepoSavedBuildCommands(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => {
        if (!selectedRepoIds.includes(id)) {
          delete next[id];
        }
      });
      return next;
    });
    setRepoSavedVerificationCommands(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => {
        if (!selectedRepoIds.includes(id)) {
          delete next[id];
        }
      });
      return next;
    });
    setDirtyRepos(prev => {
      const next = new Set(
        [...prev].filter(id => selectedRepoIds.includes(id))
      );
      return next;
    });
  }, [selectedRepoIds]);

  // const formatFileSize = (bytes: number) => {
  //   if (bytes === 0) return '0 B';
  //   const sizes = ['B', 'KB', 'MB', 'GB'];
  //   const i = Math.min(
  //     Math.floor(Math.log(bytes) / Math.log(1024)),
  //     sizes.length - 1
  //   );
  //   const value = bytes / Math.pow(1024, i);
  //   return `${value.toFixed(1)} ${sizes[i]}`;
  // };

  // const onDrop = useCallback(
  //   (acceptedFiles: File[]) => {
  //     setUploadedFiles(prev => {
  //       const remainingSlots = Math.max(0, 3 - prev.length);
  //       const nextFiles = acceptedFiles.slice(0, remainingSlots);

  //       if (acceptedFiles.length > remainingSlots) {
  //         toast({
  //           title: 'Upload limit reached',
  //           description: 'You can upload a maximum of 3 files.',
  //           variant: 'destructive',
  //         });
  //       }

  //       return [...prev, ...nextFiles];
  //     });
  //   },
  //   [toast]
  // );

  // const { getRootProps, getInputProps, isDragActive } = useDropzone({
  //   onDrop,
  //   multiple: true,
  //   maxFiles: 3,
  //   disabled: uploadedFiles.length >= 3,
  //   accept: {
  //     'image/png': [],
  //     'image/svg+xml': [],
  //     'application/pdf': [],
  //   },
  // });

  // Convert repos to MultiSelect options
  const repoOptions = availableRepos.map(repo => ({
    label: repo.name,
    value: repo.id,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col ">
        <DialogHeader>
          <DialogTitle className="text-lg">Add New Task</DialogTitle>
          <DialogDescription>
            Enter a prompt for the Sia agent to execute
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 py-4 px-2">
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
          {/* <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span className="font-medium">OR</span>
            <div className="h-px flex-1 bg-border" />
          </div> */}
          {/* <div className="space-y-2">
            <label className="text-sm font-medium">Attachments</label>
            <div
              {...getRootProps()}
              className={`flex flex-col items-center justify-center rounded-md border border-dashed px-4 py-6 text-center transition ${
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/30 bg-muted/30'
              } ${
                uploadedFiles.length >= 3
                  ? 'cursor-not-allowed opacity-70'
                  : 'cursor-pointer'
              }`}
            >
              <input {...getInputProps()} />
              <p className="text-sm font-medium">
                {isDragActive
                  ? 'Drop the files here...'
                  : 'Drag & drop files here, or click to select'}
              </p>
              <p className="text-xs text-muted-foreground">
                Max 3 files. Uploaded: {uploadedFiles.length}/3
              </p>
            </div>
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                {uploadedFiles.map(file => (
                  <div
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-border shadow-small px-3 py-2 text-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                      <span className="font-medium">{file.name}</span>
                      <span className="text-muted-foreground">
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setUploadedFiles(prev =>
                          prev.filter(
                            f =>
                              !(
                                f.name === file.name &&
                                f.size === file.size &&
                                f.lastModified === file.lastModified
                              )
                          )
                        )
                      }
                      className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div> */}
          {/* <div className="space-y-2">
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
          </div> */}
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
          {selectedRepoIds.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Selected Repositories
              </label>
              <div className="space-y-2">
                {availableRepos
                  .filter(repo => selectedRepoIds.includes(repo.id))
                  .map(repo => (
                    <div key={repo.id} className="space-y-2">
                      <div className="flex items-center justify-start gap-4 rounded-lg bg-card/50 px-4 py-3">
                        <span className="text-sm font-medium">{repo.name}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() =>
                            setConfiguringRepoId(
                              configuringRepoId === repo.id ? null : repo.id
                            )
                          }
                        >
                          {configuringRepoId === repo.id ? 'Hide' : 'Configure'}
                        </Button>
                      </div>
                      {configuringRepoId === repo.id && (
                        <div className="rounded-lg border border-border bg-card/50 px-4 py-3 space-y-3">
                          <div className="space-y-2">
                            <label
                              htmlFor={`build-${repo.id}`}
                              className="text-sm font-medium"
                            >
                              Build Commands
                            </label>
                            <Input
                              id={`build-${repo.id}`}
                              placeholder="Enter build commands (e.g., npm run build)"
                              value={repoBuildCommands[repo.id] || ''}
                              onChange={e =>
                                setRepoBuildCommands(prev => {
                                  const next = {
                                    ...prev,
                                    [repo.id]: e.target.value,
                                  };
                                  setDirtyRepos(dirty => {
                                    const updated = new Set(dirty);
                                    updated.add(repo.id);
                                    return updated;
                                  });
                                  return next;
                                })
                              }
                              className="px-4 py-3 h-12"
                            />
                          </div>
                          <div className="space-y-2">
                            <label
                              htmlFor={`verify-${repo.id}`}
                              className="text-sm font-medium"
                            >
                              Verification Commands
                            </label>
                            <Input
                              id={`verify-${repo.id}`}
                              placeholder="Enter verification commands (e.g., npm test)"
                              value={repoVerificationCommands[repo.id] || ''}
                              onChange={e =>
                                setRepoVerificationCommands(prev => {
                                  const next = {
                                    ...prev,
                                    [repo.id]: e.target.value,
                                  };
                                  setDirtyRepos(dirty => {
                                    const updated = new Set(dirty);
                                    updated.add(repo.id);
                                    return updated;
                                  });
                                  return next;
                                })
                              }
                              className="px-4 py-3 h-12"
                            />
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!dirtyRepos.has(repo.id)}
                              onClick={() => {
                                setRepoBuildCommands(prev => ({
                                  ...prev,
                                  [repo.id]:
                                    repoSavedBuildCommands[repo.id] || '',
                                }));
                                setRepoVerificationCommands(prev => ({
                                  ...prev,
                                  [repo.id]:
                                    repoSavedVerificationCommands[repo.id] ||
                                    '',
                                }));
                                setDirtyRepos(prev => {
                                  const next = new Set(prev);
                                  next.delete(repo.id);
                                  return next;
                                });
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              disabled={
                                !dirtyRepos.has(repo.id) ||
                                !(
                                  (repoBuildCommands[repo.id] || '').trim() ||
                                  (
                                    repoVerificationCommands[repo.id] || ''
                                  ).trim()
                                )
                              }
                              onClick={() => {
                                setRepoSavedBuildCommands(prev => ({
                                  ...prev,
                                  [repo.id]: repoBuildCommands[repo.id] || '',
                                }));
                                setRepoSavedVerificationCommands(prev => ({
                                  ...prev,
                                  [repo.id]:
                                    repoVerificationCommands[repo.id] || '',
                                }));
                                setDirtyRepos(prev => {
                                  const next = new Set(prev);
                                  next.delete(repo.id);
                                  return next;
                                });
                              }}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
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

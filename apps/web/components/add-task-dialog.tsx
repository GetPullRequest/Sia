'use client';

import { useEffect, useState } from 'react';
import { Plus, Loader2, CheckCircle } from 'lucide-react';
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
import { MultiSelect } from './ui/multi-select';
import { api, type Repo, getAuthHeaders } from '@/lib/api';
import {
  getReposByRepoIdConfig,
  postReposByRepoIdConfigConfirm,
} from '@sia/models/api-client';
import type { RepoConfig } from '@sia/models/api-client';
import { handleApiError } from '@/lib/api-error-handler';

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
  const [repoConfigs, setRepoConfigs] = useState<
    Map<string, { config: RepoConfig | null; isLoading: boolean }>
  >(new Map());
  const [configuringRepoId, setConfiguringRepoId] = useState<string | null>(
    null
  );
  const [configForms, setConfigForms] = useState<
    Map<
      string,
      {
        setupCommands: string;
        buildCommands: string;
        testCommands: string;
      }
    >
  >(new Map());
  // Store original values to detect changes
  const [originalConfigs, setOriginalConfigs] = useState<
    Map<
      string,
      {
        setupCommands: string;
        buildCommands: string;
        testCommands: string;
      }
    >
  >(new Map());
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
      setSelectedRepoIds([]);
      // setUploadedFiles([]);
      setRepoConfigs(new Map());
      setConfigForms(new Map());
      setOriginalConfigs(new Map());
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
    } else {
      // Reset state when dialog closes
      setPrompt('');
      setSelectedRepoIds([]);
      setRepoConfigs(new Map());
      setConfigForms(new Map());
      setOriginalConfigs(new Map());
      setConfiguringRepoId(null);
    }
  }, [open, toast]);

  // Fetch config for each selected repository
  useEffect(() => {
    const fetchConfigs = async () => {
      for (const repoId of selectedRepoIds) {
        // Skip if already loading or loaded
        if (repoConfigs.has(repoId)) {
          continue;
        }

        // Set loading state
        setRepoConfigs(prev => {
          const newMap = new Map(prev);
          newMap.set(repoId, { config: null, isLoading: true });
          return newMap;
        });

        try {
          const headers = await getAuthHeaders();
          const response = await getReposByRepoIdConfig({
            path: { repoId },
            headers,
          });
          const config = response.data as RepoConfig | null;

          setRepoConfigs(prev => {
            const newMap = new Map(prev);
            newMap.set(repoId, { config, isLoading: false });
            return newMap;
          });
        } catch (error) {
          console.error(`Failed to fetch config for repo ${repoId}:`, error);
          setRepoConfigs(prev => {
            const newMap = new Map(prev);
            newMap.set(repoId, { config: null, isLoading: false });
            return newMap;
          });
        }
      }
    };

    if (selectedRepoIds.length > 0) {
      fetchConfigs();

      // Clean up configs for repos that are no longer selected
      setRepoConfigs(prev => {
        const newMap = new Map(prev);
        for (const [repoId] of newMap) {
          if (!selectedRepoIds.includes(repoId)) {
            newMap.delete(repoId);
          }
        }
        return newMap;
      });
      setConfigForms(prev => {
        const newMap = new Map(prev);
        for (const [repoId] of newMap) {
          if (!selectedRepoIds.includes(repoId)) {
            newMap.delete(repoId);
          }
        }
        return newMap;
      });
      setOriginalConfigs(prev => {
        const newMap = new Map(prev);
        for (const [repoId] of newMap) {
          if (!selectedRepoIds.includes(repoId)) {
            newMap.delete(repoId);
          }
        }
        return newMap;
      });
    } else {
      // Clear configs when no repos selected
      setRepoConfigs(new Map());
      setConfigForms(new Map());
      setOriginalConfigs(new Map());
    }
  }, [selectedRepoIds]);

  // Initialize config forms when repo config is loaded
  useEffect(() => {
    selectedRepoIds.forEach(repoId => {
      const repoConfigData = repoConfigs.get(repoId);
      if (repoConfigData?.config) {
        setConfigForms(prev => {
          // Only initialize if not already set
          if (prev.has(repoId)) {
            return prev;
          }
          const config = repoConfigData.config!;
          const newMap = new Map(prev);
          newMap.set(repoId, {
            setupCommands: config.setupCommands?.join('\n') || '',
            buildCommands: config.buildCommands?.join('\n') || '',
            testCommands: config.testCommands?.join('\n') || '',
          });
          return newMap;
        });
      }
    });
  }, [repoConfigs, selectedRepoIds]);

  const handleAddTask = () => {
    if (prompt.trim()) {
      createJobMutation.mutate(prompt.trim());
    }
  };

  const handleCancel = () => {
    setPrompt('');
    setSelectedRepoIds([]);
    // setUploadedFiles([]);
    setRepoConfigs(new Map());
    setConfigForms(new Map());
    setOriginalConfigs(new Map());
    setConfiguringRepoId(null);
    onOpenChange(false);
  };

  // Save configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: async ({
      repoId,
      setupCommands,
      buildCommands,
      testCommands,
    }: {
      repoId: string;
      setupCommands: string;
      buildCommands: string;
      testCommands: string;
    }) => {
      const headers = await getAuthHeaders();
      const parseCommands = (text: string): string[] =>
        text
          .split('\n')
          .map(cmd => cmd.trim())
          .filter(cmd => cmd.length > 0);

      const response = await postReposByRepoIdConfigConfirm({
        path: { repoId },
        headers,
        body: {
          setupCommands: parseCommands(setupCommands),
          buildCommands: parseCommands(buildCommands),
          testCommands: parseCommands(testCommands),
        },
      });
      return response.data as RepoConfig;
    },
    onSuccess: (data, variables) => {
      // Update local config state
      setRepoConfigs(prev => {
        const newMap = new Map(prev);
        newMap.set(variables.repoId, { config: data, isLoading: false });
        return newMap;
      });

      // Update original configs to reflect saved state
      const savedValues = {
        setupCommands: data.setupCommands?.join('\n') || '',
        buildCommands: data.buildCommands?.join('\n') || '',
        testCommands: data.testCommands?.join('\n') || '',
      };
      setOriginalConfigs(prev => {
        const newMap = new Map(prev);
        newMap.set(variables.repoId, savedValues);
        return newMap;
      });

      // Update config forms to reflect saved state
      setConfigForms(prev => {
        const newMap = new Map(prev);
        newMap.set(variables.repoId, savedValues);
        return newMap;
      });

      setConfiguringRepoId(null);
      queryClient.invalidateQueries({ queryKey: ['repoConfigs'] });
      toast({
        title: 'Configuration saved',
        description: 'Repository configuration has been saved successfully',
      });
    },
    onError: (error: unknown) => {
      handleApiError(error, 'Failed to save configuration');
    },
  });

  const handleConfigureClick = (repoId: string) => {
    setConfiguringRepoId(repoId);
    const repoConfigData = repoConfigs.get(repoId);
    const originalValues = {
      setupCommands: repoConfigData?.config?.setupCommands?.join('\n') || '',
      buildCommands: repoConfigData?.config?.buildCommands?.join('\n') || '',
      testCommands: repoConfigData?.config?.testCommands?.join('\n') || '',
    };

    // Store original values
    setOriginalConfigs(prev => {
      const newMap = new Map(prev);
      newMap.set(repoId, originalValues);
      return newMap;
    });

    // Initialize form if not exists
    if (!configForms.has(repoId)) {
      setConfigForms(prev => {
        const newMap = new Map(prev);
        newMap.set(repoId, originalValues);
        return newMap;
      });
    }
  };

  // Check if there are any changes for a repository
  const hasChanges = (repoId: string): boolean => {
    const currentForm = configForms.get(repoId);
    const originalForm = originalConfigs.get(repoId);

    if (!currentForm || !originalForm) {
      return false;
    }

    // Normalize strings (trim) before comparison
    const normalize = (str: string) => str.trim();

    return (
      normalize(currentForm.setupCommands) !==
        normalize(originalForm.setupCommands) ||
      normalize(currentForm.buildCommands) !==
        normalize(originalForm.buildCommands) ||
      normalize(currentForm.testCommands) !==
        normalize(originalForm.testCommands)
    );
  };

  const handleSaveConfig = (repoId: string) => {
    const form = configForms.get(repoId);
    if (!form) return;

    saveConfigMutation.mutate({
      repoId,
      setupCommands: form.setupCommands,
      buildCommands: form.buildCommands,
      testCommands: form.testCommands,
    });
  };

  const handleCancelConfig = (repoId: string) => {
    setConfiguringRepoId(null);
    // Reset form to original config
    const originalForm = originalConfigs.get(repoId);
    if (originalForm) {
      setConfigForms(prev => {
        const newMap = new Map(prev);
        newMap.set(repoId, { ...originalForm });
        return newMap;
      });
    }
    // Clear original configs for this repo
    setOriginalConfigs(prev => {
      const newMap = new Map(prev);
      newMap.delete(repoId);
      return newMap;
    });
  };

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
          <div className="space-y-2">
            <label htmlFor="repo-select" className="text-sm font-medium">
              Repositor(ies)
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
                  .map(repo => {
                    const repoConfigData = repoConfigs.get(repo.id);
                    const isConfigured = repoConfigData?.config?.isConfirmed;
                    const isLoading = repoConfigData?.isLoading;
                    const isConfiguring = configuringRepoId === repo.id;

                    return (
                      <div key={repo.id} className="space-y-2">
                        <div className="flex items-center justify-start gap-4 rounded-lg bg-card/50 px-4 py-3">
                          <div className="w-2 h-2 bg-primary rounded-full" />
                          <span className="text-sm font-medium">
                            {repo.name}
                          </span>
                          <div className="flex items-center">
                            {isLoading ? (
                              <span className="text-xs text-muted-foreground">
                                Loading...
                              </span>
                            ) : isConfigured ? (
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 text-green-600 text-xs">
                                  <CheckCircle className="h-3 w-3" />
                                  <span>Configured</span>
                                </div>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="h-7 px-3 underline text-xs"
                                  onClick={() => {
                                    if (isConfiguring) {
                                      handleCancelConfig(repo.id);
                                    } else {
                                      handleConfigureClick(repo.id);
                                    }
                                  }}
                                  disabled={isConfiguring}
                                >
                                  {isConfiguring ? 'Hide' : 'Update'}
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="link"
                                size="sm"
                                className="h-7 px-3 underline text-xs"
                                onClick={() => {
                                  if (isConfiguring) {
                                    handleCancelConfig(repo.id);
                                  } else {
                                    handleConfigureClick(repo.id);
                                  }
                                }}
                                disabled={isConfiguring}
                              >
                                {isConfiguring ? 'Hide' : 'Configure'}
                              </Button>
                            )}
                          </div>
                        </div>
                        {isConfiguring && (
                          <div className="rounded-lg border border-border bg-card/50 px-4 py-3 space-y-4">
                            {/* Setup Commands */}
                            <div>
                              <label
                                htmlFor={`setup-${repo.id}`}
                                className="text-sm font-medium block mb-2"
                              >
                                Setup Commands
                              </label>
                              <Textarea
                                id={`setup-${repo.id}`}
                                value={
                                  configForms.get(repo.id)?.setupCommands || ''
                                }
                                onChange={e => {
                                  const form = configForms.get(repo.id);
                                  if (form) {
                                    setConfigForms(prev => {
                                      const newMap = new Map(prev);
                                      newMap.set(repo.id, {
                                        ...form,
                                        setupCommands: e.target.value,
                                      });
                                      return newMap;
                                    });
                                  }
                                }}
                                onKeyDown={e => {
                                  // Prevent Enter and Space from bubbling up
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.stopPropagation();
                                  }
                                }}
                                onClick={e => {
                                  e.stopPropagation();
                                }}
                                placeholder="npm install"
                                rows={2}
                                className="font-mono text-xs min-h-[20px] max-h-[80px]"
                              />
                            </div>

                            {/* Build Commands */}
                            <div>
                              <label
                                htmlFor={`build-${repo.id}`}
                                className="text-sm font-medium block mb-2"
                              >
                                Build Commands{' '}
                                <span className="text-muted-foreground">
                                  (optional)
                                </span>
                              </label>
                              <Textarea
                                id={`build-${repo.id}`}
                                value={
                                  configForms.get(repo.id)?.buildCommands || ''
                                }
                                onChange={e => {
                                  const form = configForms.get(repo.id);
                                  if (form) {
                                    setConfigForms(prev => {
                                      const newMap = new Map(prev);
                                      newMap.set(repo.id, {
                                        ...form,
                                        buildCommands: e.target.value,
                                      });
                                      return newMap;
                                    });
                                  }
                                }}
                                onKeyDown={e => {
                                  // Prevent Enter and Space from bubbling up
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.stopPropagation();
                                  }
                                }}
                                onClick={e => {
                                  e.stopPropagation();
                                }}
                                placeholder="npm run build"
                                rows={2}
                                className="font-mono text-xs min-h-[20px] max-h-[120px]"
                              />
                            </div>

                            {/* Validation Commands */}
                            <div>
                              <label
                                htmlFor={`test-${repo.id}`}
                                className="text-sm font-medium block mb-2"
                              >
                                Validation Commands{' '}
                                <span className="text-muted-foreground">
                                  (optional)
                                </span>
                              </label>
                              <Textarea
                                id={`test-${repo.id}`}
                                value={
                                  configForms.get(repo.id)?.testCommands || ''
                                }
                                onChange={e => {
                                  const form = configForms.get(repo.id);
                                  if (form) {
                                    setConfigForms(prev => {
                                      const newMap = new Map(prev);
                                      newMap.set(repo.id, {
                                        ...form,
                                        testCommands: e.target.value,
                                      });
                                      return newMap;
                                    });
                                  }
                                }}
                                onKeyDown={e => {
                                  // Prevent Enter and Space from bubbling up
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.stopPropagation();
                                  }
                                }}
                                onClick={e => {
                                  e.stopPropagation();
                                }}
                                placeholder="npm test"
                                rows={2}
                                className="font-mono text-xs min-h-[20px] max-h-[80px]"
                              />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={e => {
                                  e.stopPropagation();
                                  handleCancelConfig(repo.id);
                                }}
                                disabled={saveConfigMutation.isPending}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={e => {
                                  e.stopPropagation();
                                  handleSaveConfig(repo.id);
                                }}
                                disabled={
                                  saveConfigMutation.isPending ||
                                  !hasChanges(repo.id)
                                }
                              >
                                {saveConfigMutation.isPending
                                  ? 'Saving...'
                                  : 'Save'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
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

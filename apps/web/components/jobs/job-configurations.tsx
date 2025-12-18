'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Wrench, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAuthHeaders } from '@/lib/api';
import {
  getReposByRepoIdConfig,
  postReposByRepoIdConfigConfirm,
} from '@sia/models/api-client';
import type { RepoConfig } from '@sia/models/api-client';
import { handleApiError } from '@/lib/api-error-handler';
import Link from 'next/link';

interface JobConfigurationsProps {
  repositories?: Array<{
    id: string;
    name: string;
    url: string;
  }>;
}

export function JobConfigurations({
  repositories = [],
}: JobConfigurationsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

  // Fetch config for each repository
  useEffect(() => {
    const fetchConfigs = async () => {
      for (const repo of repositories) {
        // Skip if already loading or loaded
        if (repoConfigs.has(repo.id)) {
          continue;
        }

        // Set loading state
        setRepoConfigs(prev => {
          const newMap = new Map(prev);
          newMap.set(repo.id, { config: null, isLoading: true });
          return newMap;
        });

        try {
          const headers = await getAuthHeaders();
          const response = await getReposByRepoIdConfig({
            path: { repoId: repo.id },
            headers,
          });
          const config = response.data as RepoConfig | null;

          setRepoConfigs(prev => {
            const newMap = new Map(prev);
            newMap.set(repo.id, { config, isLoading: false });
            return newMap;
          });
        } catch (error) {
          console.error(`Failed to fetch config for repo ${repo.id}:`, error);
          setRepoConfigs(prev => {
            const newMap = new Map(prev);
            newMap.set(repo.id, { config: null, isLoading: false });
            return newMap;
          });
        }
      }
    };

    if (repositories.length > 0) {
      fetchConfigs();
    } else {
      // Clear configs when no repos
      setRepoConfigs(new Map());
    }
  }, [repositories]);

  // Initialize config forms when repo config is loaded
  useEffect(() => {
    repositories.forEach(repo => {
      const repoConfigData = repoConfigs.get(repo.id);
      if (repoConfigData?.config) {
        setConfigForms(prev => {
          // Only initialize if not already set
          if (prev.has(repo.id)) {
            return prev;
          }
          const config = repoConfigData.config!;
          const newMap = new Map(prev);
          newMap.set(repo.id, {
            setupCommands: config.setupCommands?.join('\n') || '',
            buildCommands: config.buildCommands?.join('\n') || '',
            testCommands: config.testCommands?.join('\n') || '',
          });
          return newMap;
        });
      }
    });
  }, [repoConfigs, repositories]);

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

  if (repositories.length === 0) {
    return null;
  }

  return (
    <Card className="w-full  shadow-none p-0">
      <CardHeader className="px-5 py-2  ">
        <CardTitle className="text-lg font-semibold text-foreground space-y-0 pb-2 flex flex-row items-center gap-2">
          <Wrench className="h-5 w-5" />
          Repositories Configurations
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-2 space-y-2">
        <ul className="space-y-2">
          {repositories.map(repo => {
            const repoConfigData = repoConfigs.get(repo.id);
            const isConfigured = repoConfigData?.config?.isConfirmed;
            const isLoading = repoConfigData?.isLoading;
            const isConfiguring = configuringRepoId === repo.id;

            return (
              <li key={repo.id} className="space-y-2">
                <div className="flex items-center justify-start gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  <span className="text-subheading font-medium">
                    {repo.name}
                  </span>
                  {repo.url && (
                    <Link
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="flex items-center text-primary hover:text-foreground transition-colors"
                      aria-label={`Open ${repo.name} repository`}
                    >
                      <ExternalLink className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  )}
                  <div className="flex items-center ">
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
                          onClick={e => {
                            e.stopPropagation();
                            handleConfigureClick(repo.id);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              // Prevent parent key handlers (like reopening job dialog)
                              e.preventDefault();
                              e.stopPropagation();
                              handleConfigureClick(repo.id);
                            }
                          }}
                          disabled={isConfiguring}
                        >
                          Update
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-7 px-3  underline text-xs"
                        onClick={e => {
                          e.stopPropagation();
                          handleConfigureClick(repo.id);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            // Prevent parent key handlers (like reopening job dialog)
                            e.preventDefault();
                            e.stopPropagation();
                            handleConfigureClick(repo.id);
                          }
                        }}
                        disabled={isConfiguring}
                      >
                        {/* <Settings className="h-3 w-3 mr-1" /> */}
                        Configure
                      </Button>
                    )}
                  </div>
                </div>

                {/* Configuration Form - appears directly below the repository */}
                {isConfiguring && (
                  <div
                    className="ml-6 p-4 border border-border rounded-lg bg-card space-y-4"
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => {
                      // Prevent Enter and Space from bubbling up when inside the form
                      if (e.key === 'Enter' || e.key === ' ') {
                        const target = e.target as HTMLElement;
                        // Only stop propagation if not on a button or textarea
                        if (
                          target.tagName !== 'BUTTON' &&
                          target.tagName !== 'TEXTAREA'
                        ) {
                          e.stopPropagation();
                        }
                      }
                    }}
                  >
                    {/* Setup Commands */}
                    <div>
                      <label className="text-sm font-medium block mb-2">
                        Setup Commands
                      </label>
                      <Textarea
                        value={configForms.get(repo.id)?.setupCommands || ''}
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
                          // Ctrl+Enter / Cmd+Enter saves this repo's configuration
                          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            if (
                              !saveConfigMutation.isPending &&
                              hasChanges(repo.id)
                            ) {
                              handleSaveConfig(repo.id);
                            }
                            return;
                          }
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
                      <label className="text-sm font-medium block mb-2">
                        Build Commands{' '}
                        <span className="text-muted-foreground">
                          (optional)
                        </span>
                      </label>
                      <Textarea
                        value={configForms.get(repo.id)?.buildCommands || ''}
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
                          // Ctrl+Enter / Cmd+Enter saves this repo's configuration
                          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            if (
                              !saveConfigMutation.isPending &&
                              hasChanges(repo.id)
                            ) {
                              handleSaveConfig(repo.id);
                            }
                            return;
                          }
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
                      <label className="text-sm font-medium block mb-2">
                        Validation Commands{' '}
                        <span className="text-muted-foreground">
                          (optional)
                        </span>
                      </label>
                      <Textarea
                        value={configForms.get(repo.id)?.testCommands || ''}
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
                          // Ctrl+Enter / Cmd+Enter saves this repo's configuration
                          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            if (
                              !saveConfigMutation.isPending &&
                              hasChanges(repo.id)
                            ) {
                              handleSaveConfig(repo.id);
                            }
                            return;
                          }
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

                    <div className="flex gap-2 justify-end mt-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCancelConfig(repo.id);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCancelConfig(repo.id);
                          }
                        }}
                        disabled={saveConfigMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSaveConfig(repo.id);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSaveConfig(repo.id);
                          }
                        }}
                        disabled={
                          saveConfigMutation.isPending || !hasChanges(repo.id)
                        }
                      >
                        {saveConfigMutation.isPending ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

'use client';

import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  MultiSelect,
  type MultiSelectOption,
} from '@/components/ui/multi-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import type { JobResponse } from '@/types';
import { formatRelativeTime } from './job-constants';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface JobHeaderProps {
  job: JobResponse;
  maxVersion?: number;
  selectedVersion?: number;
  onVersionChange?: (version: number) => void;
  isReadOnly?: boolean;
  editForm: {
    generated_name: string;
    generated_description: string;
    user_input_prompt: string;
    order_in_queue: string;
    repo_names: string[];
    priority: string;
  };
  titleError: string;
  onEditFormChange: (field: string, value: string) => void;
  onTitleErrorChange: (error: string) => void;
  onRepoChange: (repoNames: string[], repoIds?: string[]) => void;
  jobRepositories?: Array<{
    id: string;
    name: string;
    url: string;
  }>;
  onClose?: () => void;
  onBackClick?: () => void;
}

export function JobHeaderSection({
  job,
  maxVersion,
  selectedVersion,
  onVersionChange,
  isReadOnly = false,
  editForm,
  titleError,
  onEditFormChange,
  onTitleErrorChange,
  onRepoChange,
  jobRepositories = [],
  onClose,
  onBackClick,
}: JobHeaderProps) {
  const { toast } = useToast();
  const { theme } = useTheme();
  const githubIconSrc =
    theme === 'dark' ? '/icons/github-dark.svg' : '/icons/github.png';
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [availableRepos, setAvailableRepos] = useState<
    Array<{ id: string; name: string; url: string }>
  >([]);

  // Track the last valid name to restore if user tries to clear it
  const lastValidNameRef = useRef<string>(
    editForm.generated_name || job?.generated_name || ''
  );
  const titleInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(
    null
  );
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Update lastValidNameRef when editForm.generated_name or job.generated_name changes from external updates
  useEffect(() => {
    if (editForm.generated_name && editForm.generated_name.trim() !== '') {
      lastValidNameRef.current = editForm.generated_name;
    } else if (job?.generated_name && job.generated_name.trim() !== '') {
      lastValidNameRef.current = job.generated_name;
    }
  }, [editForm.generated_name, job?.generated_name]);

  const loadRepos = useCallback(
    async (providerId: string) => {
      setIsLoadingRepos(true);
      try {
        const repos = await api.getGitHubRepos(providerId);
        setAvailableRepos(
          repos.map(repo => ({
            id: repo.id,
            name: repo.name,
            url: repo.url,
          }))
        );
      } catch (error) {
        console.error('Failed to load repos:', error);
        toast({
          title: 'Failed to load repos',
          description: 'Unable to load repositories. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingRepos(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    const fetchProvidersAndRepos = async () => {
      try {
        const providers = await api.getGitHubProviders();
        if (providers.length > 0) {
          const firstProviderId = providers[0].id;
          setSelectedProviderId(firstProviderId);
          await loadRepos(firstProviderId);
        }
      } catch (error) {
        console.error('Failed to load providers:', error);
        toast({
          title: 'Failed to load providers',
          description: 'Unable to load GitHub providers. Please try again.',
          variant: 'destructive',
        });
      }
    };

    fetchProvidersAndRepos();
  }, [loadRepos, toast]);

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent Enter key from bubbling up and triggering modal reopening
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      // Blur the input to remove focus
      event.currentTarget.blur();
    }
    // Prevent space key from propagating
    if (event.key === ' ') {
      event.stopPropagation();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Prevent Enter key from bubbling up and triggering modal reopening
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleRepoChange = (selectedNames: string[]) => {
    // Convert names to IDs using the repo map
    const selectedIds = selectedNames
      .map(name => repoNameToIdMap.get(name))
      .filter((id): id is string => id !== undefined);

    // Pass both names (for form state) and IDs (for API update)
    onRepoChange(selectedNames, selectedIds);
  };

  // Merge API-loaded repos with job repositories to ensure all job repos are available
  // even if they're not in the current API list (e.g., if repo was deleted)
  const allAvailableRepos = useMemo(() => {
    const repoMap = new Map<
      string,
      { id: string; name: string; url: string }
    >();

    // Add API-loaded repos
    availableRepos.forEach(repo => {
      repoMap.set(repo.id, repo);
    });

    // Add job repositories (these take precedence if there's a conflict)
    jobRepositories.forEach(repo => {
      repoMap.set(repo.id, repo);
    });

    return Array.from(repoMap.values());
  }, [availableRepos, jobRepositories]);

  // Create a map of repo name to ID for easy lookup
  const repoNameToIdMap = useMemo(() => {
    const map = new Map<string, string>();
    allAvailableRepos.forEach(repo => {
      map.set(repo.name, repo.id);
    });
    return map;
  }, [allAvailableRepos]);

  // Convert available repos to MultiSelect options format
  const repoOptions: MultiSelectOption[] = allAvailableRepos.map(repo => ({
    label: repo.name,
    value: repo.name,
  }));

  const effectiveMaxVersion = useMemo(
    () => Math.max(maxVersion ?? job.version ?? 1, 1),
    [maxVersion, job.version]
  );

  const effectiveSelectedVersion =
    selectedVersion ?? job.version ?? effectiveMaxVersion;

  const versionOptions = useMemo(
    () => Array.from({ length: effectiveMaxVersion }, (_, index) => index + 1),
    [effectiveMaxVersion]
  );

  const selectedRepoNames = editForm.repo_names;
  // : jobRepositories.map(repo => repo.name)) || [];

  return (
    <div className="rounded-2xl p-2">
      <div className="flex items-start w-full  gap-3">
        <div className="space-y-2 w-full">
          {!onClose && onBackClick && (
            <div className="flex flex-row justify-between items-center w-full">
              <Button variant="ghost" size="sm" onClick={onBackClick}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2 w-full">
            {/* <span
              className={cn(
                'h-3 w-3 rounded-full',
                statusColors[job.status] || 'bg-muted-foreground'
              )}
            /> */}
            <div className="w-full flex flex-col ">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  {isReadOnly ? (
                    <div className="text-2xl font-semibold max-w-2xl flex items-center line-clamp-2">
                      {editForm.generated_name ||
                        job?.generated_name ||
                        'Untitled job'}
                    </div>
                  ) : (
                    <div className="w-[80%] flex items-center">
                      {isEditingTitle ? (
                        <Input
                          asTextarea
                          ref={titleInputRef}
                          value={editForm.generated_name}
                          onChange={e => {
                            const newValue = e.target.value;
                            // If user tries to clear the field entirely, restore last valid name
                            if (newValue.trim() === '') {
                              const lastValid =
                                lastValidNameRef.current ||
                                job?.generated_name ||
                                '';
                              // Restore the last valid name immediately
                              onEditFormChange('generated_name', lastValid);
                              onTitleErrorChange('Job title is mandatory.');
                              return;
                            }
                            // Update last valid name if the new value is valid
                            lastValidNameRef.current = newValue;
                            onEditFormChange('generated_name', newValue);
                            onTitleErrorChange('');
                          }}
                          onKeyDown={e => {
                            handleInputKeyDown(
                              e as React.KeyboardEvent<HTMLInputElement>
                            );
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsEditingTitle(false);
                            }
                          }}
                          onBlur={() => {
                            setIsEditingTitle(false);
                          }}
                          placeholder="Job title"
                          className={cn(
                            'text-2xl w-2xl font-semibold w-full border-none bg-card outline-none',
                            titleError && 'border-destructive'
                          )}
                        />
                      ) : (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={e => {
                            e.stopPropagation();
                            setIsEditingTitle(true);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsEditingTitle(true);
                            }
                          }}
                          className={cn(
                            'text-2xl font-semibold w-full cursor-text text-foreground line-clamp-2',
                            titleError && 'border-destructive'
                          )}
                        >
                          {editForm.generated_name ||
                            job?.generated_name ||
                            'Untitled job'}
                        </div>
                      )}
                    </div>
                  )}

                  {versionOptions.length > 0 && (
                    <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        {/* <span>Version</span> */}
                        <Select
                          value={String(effectiveSelectedVersion)}
                          onValueChange={value => {
                            const numericVersion = parseInt(value, 10);
                            if (
                              Number.isNaN(numericVersion) ||
                              numericVersion === effectiveSelectedVersion
                            ) {
                              return;
                            }
                            onVersionChange?.(numericVersion);
                          }}
                        >
                          <SelectTrigger
                            className="h-8  border-none bg-card px-2 py-1 text-xs cursor-pointer focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            onClick={e => {
                              e.stopPropagation();
                            }}
                            onKeyDown={handleKeyDown}
                          >
                            <SelectValue placeholder="Select version" />
                          </SelectTrigger>
                          <SelectContent
                            className="z-[10000] border-border"
                            position="popper"
                            onKeyDown={handleKeyDown}
                          >
                            {versionOptions.map(version => (
                              <SelectItem
                                key={version}
                                value={String(version)}
                                className="text-xs"
                              >
                                V{version}
                                {version === effectiveMaxVersion
                                  ? ' (latest)'
                                  : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {isReadOnly && (
                        <span className="text-[11px] text-muted-foreground/80">
                          Select current version to edit any values
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {!isReadOnly && titleError && (
                  <p className="text-xs text-destructive">{titleError}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-4 text-xs text-muted-foreground">
                <div
                  className="flex items-center gap-1.5"
                  onKeyDown={e => {
                    // Prevent Enter key from bubbling up to parent elements
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  onClick={e => {
                    // Stop click events from bubbling up
                    e.stopPropagation();
                  }}
                >
                  <Image
                    src={githubIconSrc}
                    alt="GitHub"
                    width={16}
                    height={16}
                    className="h-4 w-4"
                  />
                  {selectedProviderId ? (
                    isReadOnly ? (
                      <span
                        className={cn(
                          'text-xs',
                          (!selectedRepoNames ||
                            selectedRepoNames.length === 0) &&
                            'text-destructive font-semibold'
                        )}
                      >
                        {selectedRepoNames && selectedRepoNames.length > 0
                          ? selectedRepoNames.join(', ')
                          : '⚠️ No repository selected'}
                      </span>
                    ) : (
                      <MultiSelect
                        options={repoOptions}
                        selected={editForm.repo_names || []}
                        onChange={handleRepoChange}
                        placeholder={
                          isLoadingRepos
                            ? 'Loading repos...'
                            : repoOptions.length === 0
                            ? 'No repositories available'
                            : (editForm.repo_names?.length || 0) === 0
                            ? '⚠️ No repository selected'
                            : 'Select repositories...'
                        }
                        disabled={isLoadingRepos || repoOptions.length === 0}
                        className={cn(
                          (!editForm.repo_names ||
                            editForm.repo_names.length === 0) &&
                            'text-destructive font-semibold'
                        )}
                      />
                    )
                  ) : (
                    <span className="text-xs">Loading providers...</span>
                  )}
                </div>

                {/* {job.user_input?.source && (
                  <>
                    <Separator orientation="vertical" className="h-4" />
                    <span className="capitalize">{job.user_input.source}</span>
                  </>
                )} */}
                {job.status === 'queued' &&
                  job.order_in_queue !== undefined && (
                    <>
                      <Separator orientation="vertical" className="h-4" />
                      <div className="flex items-center gap-1.5">
                        <span>Order:</span>
                        {isReadOnly ? (
                          <span className="text-xs font-medium">
                            {editForm.order_in_queue ||
                              (job.order_in_queue ?? '').toString()}
                          </span>
                        ) : (
                          <Input
                            type="number"
                            min="0"
                            value={editForm.order_in_queue}
                            onChange={e => {
                              const value = e.target.value;
                              // Allow empty string for clearing, or non-negative numbers
                              if (value === '' || value === '-') {
                                onEditFormChange('order_in_queue', value);
                                return;
                              }
                              const numValue = parseInt(value, 10);
                              // Only allow non-negative values (0 and positive integers)
                              if (!isNaN(numValue) && numValue >= 0) {
                                onEditFormChange('order_in_queue', value);
                              } else if (value.startsWith('-')) {
                                // If user tries to enter negative, ignore it
                                return;
                              }
                            }}
                            onKeyDown={handleInputKeyDown}
                            placeholder="Queue position"
                            className="h-7 w-14 text-xs bg-card outline-none border-none"
                          />
                        )}
                      </div>
                    </>
                  )}
                <Separator orientation="vertical" className="h-4" />
                <div
                  className="flex items-center gap-1.5"
                  onKeyDown={e => {
                    // Prevent Enter key from bubbling up to parent elements
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  onClick={e => {
                    // Stop click events from bubbling up
                    e.stopPropagation();
                  }}
                >
                  <span>Priority:</span>
                  {isReadOnly ? (
                    <span className="font-medium capitalize">
                      {editForm.priority || job.priority || 'medium'}
                    </span>
                  ) : (
                    <Select
                      value={editForm.priority || 'medium'}
                      onValueChange={value => {
                        if (value) {
                          onEditFormChange('priority', value);
                        }
                      }}
                      onOpenChange={open => {
                        // When select closes, ensure no events bubble up
                        if (!open) {
                          // Small delay to ensure any pending events are handled
                          setTimeout(() => {
                            // Focus management to prevent modal reopening
                            const activeElement =
                              document.activeElement as HTMLElement;
                            if (activeElement) {
                              activeElement.blur();
                            }
                          }, 0);
                        }
                      }}
                    >
                      <SelectTrigger
                        className={cn(
                          'h-8 gap-2  w-fit border-none bg-card px-2 py-1 text-xs cursor-pointer focus:ring-2 focus:ring-ring focus:ring-offset-2'
                        )}
                        onClick={e => {
                          e.stopPropagation();
                        }}
                        onKeyDown={handleKeyDown}
                      >
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent
                        className="z-[10000] border-border"
                        position="popper"
                        onKeyDown={handleKeyDown}
                      >
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <Separator orientation="vertical" className="h-4" />
                <span>Updated {formatRelativeTime(job.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

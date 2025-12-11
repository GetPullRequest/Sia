'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { ArrowLeft, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { JobResponse } from '@/types';
import { formatRelativeTime } from './job-constants';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface JobHeaderProps {
  job: JobResponse;
  isEditMode: boolean;
  editForm: {
    generated_name: string;
    generated_description: string;
    user_input_prompt: string;
    order_in_queue: string;
    repo_name: string;
  };
  titleError: string;
  onEditFormChange: (field: string, value: string) => void;
  onTitleErrorChange: (error: string) => void;
  onRepoChange: (repoName: string) => void;
  onClose?: () => void;
  onBackClick?: () => void;
}

export function JobHeaderSection({
  job,
  isEditMode,
  editForm,
  titleError,
  onEditFormChange,
  onTitleErrorChange,
  onRepoChange,
  onClose,
  onBackClick,
}: JobHeaderProps) {
  const { toast } = useToast();
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [availableRepos, setAvailableRepos] = useState<
    Array<{ id: string; name: string; url: string }>
  >([]);

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
    if (!isEditMode) return;

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
  }, [isEditMode, loadRepos, toast]);

  const stopSpacePropagation = (event: React.KeyboardEvent) => {
    if (event.key === ' ') {
      event.stopPropagation();
      // event.preventDefault();
    }
  };

  const handleRepoChange = (value: string) => {
    onEditFormChange('repo_name', value);
    console.log('value', value);
    const selectedRepo = availableRepos.find(repo => repo.id === value);
    onRepoChange(selectedRepo?.name || value);
  };

  return (
    <div className="rounded-3xl  p-3 ">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          {!onClose && onBackClick && (
            <div className="flex flex-row justify-between items-center w-full">
              <Button variant="ghost" size="sm" onClick={onBackClick}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </div>
          )}
          <div className="flex items-center gap-3">
            {/* <span
              className={cn(
                'h-3 w-3 rounded-full',
                statusColors[job.status] || 'bg-muted-foreground'
              )}
            /> */}
            <div>
              {isEditMode ? (
                <div className="space-y-1">
                  <Input
                    value={editForm.generated_name}
                    onChange={e => {
                      onEditFormChange('generated_name', e.target.value);
                      onTitleErrorChange('');
                    }}
                    onKeyDown={stopSpacePropagation}
                    placeholder="Job title"
                    className={cn(
                      'text-xl font-semibold h-auto border-none py-2 bg-card outline-none',
                      titleError && 'border-destructive'
                    )}
                  />
                  {titleError && (
                    <p className="text-xs text-destructive">{titleError}</p>
                  )}
                </div>
              ) : (
                <h1 className="text-base font-semibold">
                  {job?.generated_name || 'Untitled Job'}
                </h1>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                {isEditMode ? (
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    {selectedProviderId ? (
                      <select
                        value={editForm.repo_name}
                        onChange={e => handleRepoChange(e.target.value)}
                        onKeyDown={stopSpacePropagation}
                        className="flex h-8 rounded-md border border-input bg-card px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isLoadingRepos}
                      >
                        {isLoadingRepos ? (
                          <option value="">Loading repos...</option>
                        ) : availableRepos.length === 0 ? (
                          <option value="">No repositories available</option>
                        ) : (
                          <>
                            <option value="">
                              No repository (use default)
                            </option>
                            {availableRepos.map(repo => (
                              <option key={repo.id} value={repo.name}>
                                {repo.name}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    ) : (
                      <span className="text-xs">Loading providers...</span>
                    )}
                  </div>
                ) : (
                  <>
                    {job.repo_url ? (
                      <Link
                        href={job.repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-primary transition-colors underline"
                      >
                        <GitBranch className="h-4 w-4" />
                        {(() => {
                          try {
                            const url = new URL(job.repo_url);
                            if (url.hostname.includes('github.com')) {
                              const parts = url.pathname
                                .split('/')
                                .filter(Boolean);
                              if (parts.length >= 2) {
                                return `${parts[0]}/${parts[1]}`;
                              }
                            }
                          } catch {
                            // Ignore URL parsing errors
                          }
                          return job.repo_name || job.repo_id || 'Repository';
                        })()}
                      </Link>
                    ) : (
                      <Link
                        href="https://github.com/getpullrequest/sia"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-primary transition-colors underline"
                      >
                        <GitBranch className="h-4 w-4" />
                        @getpullrequest/sia
                      </Link>
                    )}
                  </>
                )}

                {job.user_input?.source && (
                  <>
                    <Separator orientation="vertical" className="h-4" />
                    <span className="capitalize">{job.user_input.source}</span>
                  </>
                )}
                {(isEditMode ||
                  (job.status === 'queued' &&
                    job.order_in_queue !== undefined)) && (
                  <>
                    <Separator orientation="vertical" className="h-4" />
                    {isEditMode ? (
                      <div className="flex items-center gap-2">
                        <span>Order:</span>
                        <Input
                          type="number"
                          value={editForm.order_in_queue}
                          onChange={e =>
                            onEditFormChange('order_in_queue', e.target.value)
                          }
                          onKeyDown={stopSpacePropagation}
                          placeholder="Queue position"
                          className="h-7 w-20 text-xs bg-card outline-none"
                        />
                      </div>
                    ) : (
                      <span>Order: {job.order_in_queue}</span>
                    )}
                  </>
                )}
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

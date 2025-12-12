'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { JobResponse } from '@/types';
import { formatRelativeTime } from './job-constants';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface JobHeaderProps {
  job: JobResponse;
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
                <Input
                  value={editForm.generated_name}
                  onChange={e => {
                    onEditFormChange('generated_name', e.target.value);
                    onTitleErrorChange('');
                  }}
                  onKeyDown={stopSpacePropagation}
                  placeholder="Job title"
                  className={cn(
                    'text-2xl font-semibold max-w-2xl h-14 border-none  bg-card outline-none',
                    titleError && 'border-destructive'
                  )}
                />
                {titleError && (
                  <p className="text-xs text-destructive">{titleError}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Image
                    src="/icons/github.png"
                    alt="GitHub"
                    width={16}
                    height={16}
                    className="h-4 w-4"
                  />
                  {selectedProviderId ? (
                    <select
                      value={editForm.repo_name}
                      onChange={e => handleRepoChange(e.target.value)}
                      onKeyDown={stopSpacePropagation}
                      className={cn(
                        'flex h-8 rounded-md border-none bg-card py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                        !editForm.repo_name && 'text-destructive font-semibold'
                      )}
                      disabled={isLoadingRepos}
                    >
                      {isLoadingRepos ? (
                        <option value="">Loading repos...</option>
                      ) : availableRepos.length === 0 ? (
                        <option value="">No repositories available</option>
                      ) : (
                        <>
                          <option
                            value=""
                            className="text-destructive font-semibold"
                          >
                            ⚠️ No repository selected
                          </option>
                          {availableRepos.map(repo => (
                            <option
                              key={repo.id}
                              value={repo.name}
                              className="text-foreground"
                            >
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

                {job.user_input?.source && (
                  <>
                    <Separator orientation="vertical" className="h-4" />
                    <span className="capitalize">{job.user_input.source}</span>
                  </>
                )}
                {job.status === 'queued' &&
                  job.order_in_queue !== undefined && (
                    <>
                      <Separator orientation="vertical" className="h-4" />
                      <div className="flex items-center gap-1.5">
                        <span>Order:</span>
                        <Input
                          type="number"
                          value={editForm.order_in_queue}
                          onChange={e =>
                            onEditFormChange('order_in_queue', e.target.value)
                          }
                          onKeyDown={stopSpacePropagation}
                          placeholder="Queue position"
                          className="h-7 w-14 text-xs bg-card outline-none border-none"
                        />
                      </div>
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

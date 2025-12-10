'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { ArrowLeft, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { JobResponse } from '@/types';
import {
  statusColors,
  acceptanceStyles,
  formatRelativeTime,
} from './job-constants';

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
  selectedProviderId: string;
  isLoadingRepos: boolean;
  availableRepos: Array<{ id: string; name: string; url: string }>;
  onEditFormChange: (field: string, value: string) => void;
  onTitleErrorChange: (error: string) => void;
  acceptanceStatus: string;
  onClose?: () => void;
  onBackClick?: () => void;
}

export function JobHeaderSection({
  job,
  isEditMode,
  editForm,
  titleError,
  selectedProviderId,
  isLoadingRepos,
  availableRepos,
  onEditFormChange,
  onTitleErrorChange,
  acceptanceStatus,
  onClose,
  onBackClick,
}: JobHeaderProps) {
  return (
    <div className="rounded-3xl bg-card p-6 shadow-lg shadow-black/5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          {!onClose && onBackClick && (
            <Button variant="ghost" size="sm" onClick={onBackClick}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          )}
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'h-3 w-3 rounded-full',
                statusColors[job.status] || 'bg-muted-foreground'
              )}
            />
            <div>
              {isEditMode ? (
                <div className="space-y-1">
                  <Input
                    value={editForm.generated_name}
                    onChange={e => {
                      onEditFormChange('generated_name', e.target.value);
                      onTitleErrorChange('');
                    }}
                    placeholder="Job title"
                    className={cn(
                      'text-2xl font-semibold h-auto py-2',
                      titleError && 'border-destructive'
                    )}
                  />
                  {titleError && (
                    <p className="text-sm text-destructive">{titleError}</p>
                  )}
                </div>
              ) : (
                <h1 className="text-xl font-semibold">
                  {job?.generated_name || 'Untitled Job'}
                </h1>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-muted-foreground">
                {isEditMode ? (
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    {selectedProviderId ? (
                      <select
                        value={editForm.repo_name}
                        onChange={e =>
                          onEditFormChange('repo_name', e.target.value)
                        }
                        className="flex h-8 rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                          placeholder="Queue position"
                          className="h-7 w-20 text-sm"
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
        <div className="flex flex-wrap gap-2">
          <Badge className="capitalize">{job.status}</Badge>
          <Badge variant="secondary" className="capitalize">
            {job.priority}
          </Badge>
          {job.status === 'in-review' && (
            <Badge
              className={cn(
                'capitalize',
                acceptanceStyles[
                  acceptanceStatus as keyof typeof acceptanceStyles
                ]
              )}
            >
              {acceptanceStatus.replace(/_/g, ' ')}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

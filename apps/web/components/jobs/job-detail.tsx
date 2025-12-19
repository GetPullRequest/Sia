'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { JobResponse, UpdateJobRequest } from '@/types';
import {
  Code,
  ShieldCheck,
  ChevronDown,
  Logs,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { JobHeaderSection } from './job-header-section';
import { JobRetryForm } from './job-retry-form';
import { JobDescription } from './job-description';
import { JobComments } from './job-comments';
import { JobConfigurations } from './job-configurations';
import { StreamingLogsViewer } from './streaming-logs-viewer';
import {
  CollapsibleContent,
  CollapsibleTrigger,
  Collapsible,
} from '../ui/collapsible';
import { ScrollArea } from '../ui/scroll-area';
import { useDebouncedCallback } from 'use-debounce';
import { useAuthInfo } from '@propelauth/react';
import { JobPullRequest } from './job-pull-request';

interface JobDetailProps {
  job: JobResponse;
  isLoading?: boolean;
  onClose?: () => void;
  isModalOpen?: boolean;
  isRetryFormOpen: boolean;
  onRetryCancel: () => void;
  onRetrySuccess: () => void;
  showDeleteConfirmation?: boolean;
  onDeleteConfirm?: () => void;
  onDeleteCancel?: () => void;
  isDeleting?: boolean;
}

export function JobDetail({
  job,
  isLoading,
  onClose,
  isModalOpen = true,
  isRetryFormOpen,
  onRetryCancel,
  onRetrySuccess,
  showDeleteConfirmation,
  onDeleteConfirm,
  onDeleteCancel,
  isDeleting,
}: JobDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const authInfo = useAuthInfo();
  const currentUserName =
    authInfo.user?.firstName || authInfo.user?.lastName
      ? `${authInfo.user?.firstName || ''} ${
          authInfo.user?.lastName || ''
        }`.trim()
      : authInfo.user?.email?.split('@')[0] || 'You';
  const [logsOpen, setLogsOpen] = useState({
    generation: false,
    verification: false,
  });
  const [activeJob, setActiveJob] = useState<JobResponse>(job);
  const [maxVersion, setMaxVersion] = useState(job.version);
  const [selectedVersion, setSelectedVersion] = useState(job.version);
  const [editForm, setEditForm] = useState({
    generated_name: job?.generated_name || '',
    generated_description: job?.generated_description || '',
    user_input_prompt: job?.user_input?.prompt || '',
    order_in_queue: job?.order_in_queue?.toString() || '',
    repo_names: job?.repositories?.map(repo => repo.name) || [],
    priority: job?.priority || 'medium',
  });
  const [titleError, setTitleError] = useState<string>('');

  const isViewingLatestVersion = selectedVersion === maxVersion;

  useEffect(() => {
    setMaxVersion(prev => Math.max(prev, job.version));
    if (selectedVersion === job.version) {
      setActiveJob(job);
    }
  }, [job, selectedVersion]);

  useEffect(() => {
    setEditForm({
      generated_name: activeJob?.generated_name || '',
      generated_description: activeJob?.generated_description || '',
      user_input_prompt: activeJob?.user_input?.prompt || '',
      order_in_queue: activeJob?.order_in_queue?.toString() || '',
      repo_names: activeJob?.repositories?.map(repo => repo.name) || [],
      priority: activeJob?.priority || 'medium',
    });
  }, [
    activeJob?.generated_name,
    activeJob?.generated_description,
    activeJob?.user_input?.prompt,
    activeJob?.order_in_queue,
    activeJob?.repositories,
    activeJob?.priority,
  ]);

  const inlineUpdateMutation = useMutation({
    mutationFn: async (updates: UpdateJobRequest) => {
      const result = await api.updateJob(job.id, updates);
      if (!result) {
        throw new Error('Failed to update job');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: () => {
      toast({
        title: 'Update failed',
        description: 'Unable to update the job. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const debouncedInlineUpdate = useDebouncedCallback(
    (updates: UpdateJobRequest) => {
      if (!Object.keys(updates).length) return;
      inlineUpdateMutation.mutate(updates);
      console.log('updates', updates);
    },
    1000
  );

  // Store pending updates to flush immediately on user actions
  const pendingUpdatesRef = useRef<UpdateJobRequest | null>(null);

  // Flush pending updates immediately
  const flushPendingUpdates = () => {
    if (
      pendingUpdatesRef.current &&
      Object.keys(pendingUpdatesRef.current).length > 0
    ) {
      debouncedInlineUpdate.flush();
      pendingUpdatesRef.current = null;
    }
  };

  // Track pending updates
  const handleInlineChangeWithTracking = (field: string, value: string) => {
    // Prevent editing when viewing a non-latest version
    if (!isViewingLatestVersion) {
      return;
    }

    setEditForm(prev => ({ ...prev, [field]: value }));

    const updates: UpdateJobRequest = {
      updated_by: currentUserName,
    };

    if (field === 'generated_name') {
      if (!value.trim()) {
        setTitleError('Job title is mandatory.');
        return;
      }
      setTitleError('');
      updates.generated_name = value;
    }

    if (field === 'generated_description') {
      updates.generated_description = value;
    }

    if (field === 'order_in_queue') {
      const parsedOrder = parseInt(value, 10);
      // Only allow non-negative values (0 and positive integers)
      if (!Number.isNaN(parsedOrder) && parsedOrder >= 0) {
        updates.order_in_queue = parsedOrder;
      } else {
        return;
      }
    }

    if (field === 'priority') {
      if (value === 'low' || value === 'medium' || value === 'high') {
        updates.priority = value;
      } else {
        return;
      }
    }

    debouncedInlineUpdate(updates);
  };

  const handleRepoChangeWithTracking = (
    repoNames: string[],
    repoIds?: string[]
  ) => {
    // Prevent editing when viewing a non-latest version
    if (!isViewingLatestVersion) {
      return;
    }

    setEditForm(prev => ({ ...prev, repo_names: repoNames }));

    const updates: UpdateJobRequest = {
      updated_by: currentUserName,
    };

    // Use the provided repo IDs if available, otherwise try to map from names
    if (repoIds && repoIds.length > 0) {
      updates.repos = repoIds;
    } else if (repoNames.length > 0) {
      // Fallback: try to map names to IDs from job.repositories
      const mappedIds = repoNames
        .map(name => {
          const repo = activeJob?.repositories?.find(r => r.name === name);
          return repo?.id;
        })
        .filter((id): id is string => id !== undefined);

      if (mappedIds.length > 0) {
        updates.repos = mappedIds;
      } else {
        // If we can't map to IDs, don't update yet
        return;
      }
    } else {
      // If no repos selected, set to empty array
      updates.repos = [];
    }

    debouncedInlineUpdate(updates);
  };

  // Handle ESC key and other user actions
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        flushPendingUpdates();
      }
    };

    if (isModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (isModalOpen) {
        window.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [isModalOpen]);

  // Flush pending updates when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      flushPendingUpdates();
    }
  }, [isModalOpen]);

  // Flush pending updates when retry form opens or delete confirmation shows
  useEffect(() => {
    if (isRetryFormOpen || showDeleteConfirmation) {
      flushPendingUpdates();
    }
  }, [isRetryFormOpen, showDeleteConfirmation]);

  // Flush pending updates when navigating away
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushPendingUpdates();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading job details…</p>
      </div>
    );
  }

  const comments = Array.isArray(activeJob.user_comments)
    ? activeJob.user_comments
    : [];

  // Helper function to format JSON logs to string
  const formatLogs = (logs: unknown): string => {
    if (!logs) return '';
    if (typeof logs === 'string') return logs; // Backward compatibility
    if (Array.isArray(logs)) {
      return logs
        .map(
          (log: { level?: string; timestamp?: string; message?: string }) => {
            const timestamp = log.timestamp
              ? new Date(log.timestamp).toLocaleString()
              : '';
            const level = log.level?.toUpperCase() || 'INFO';
            const message = log.message || '';
            return `[${timestamp}] ${level} ${message}`;
          }
        )
        .join('\n');
    }
    return '';
  };

  // const getGenerationLogsContent = () => {
  //   if (Array.isArray(job.code_generation_logs)) {
  //     return job.code_generation_logs
  //       .map(log =>
  //         typeof log === 'string' ? log : JSON.stringify(log, null, 2)
  //       )
  //       .join('\n');
  //   }
  //   return formatLogs(job.code_generation_logs);
  // };

  const getVerificationLogsContent = () =>
    formatLogs(activeJob.code_verification_logs);

  const handleVersionChange = async (version: number) => {
    if (!version || version === selectedVersion) return;

    try {
      const updatedJob = (await api.getJob(job.id, version)) as
        | JobResponse
        | undefined;
      if (!updatedJob) {
        toast({
          variant: 'destructive',
          description: `Unable to load job version ${version}.`,
        });
        return;
      }
      setSelectedVersion(updatedJob.version ?? version);
      setActiveJob(updatedJob);
    } catch (error) {
      console.error('Failed to load job version:', error);
      toast({
        variant: 'destructive',
        description:
          'Failed to load the selected job version. Please try again.',
      });
    }
  };

  return (
    <div className="flex w-full flex-col gap-4 max-h-[85vh] overflow-auto px-2 lg:px-0">
      {showDeleteConfirmation && (
        <div className="flex items-start justify-between gap-3 rounded-2xl bg-card px-4 py-3">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </span>
            <div className="space-y-1">
              <p className="text-base font-semibold text-destructive">
                Are you sure you want to delete “
                {activeJob.generated_name || 'this job'}”?
              </p>
              <p className="text-xs text-muted-foreground">
                This action cannot be undone. The job and its data will be
                removed.
              </p>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDeleteCancel?.()}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="text-white hover:text-white"
              onClick={() => onDeleteConfirm?.()}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Confirm delete'}
            </Button>
          </div>
        </div>
      )}
      {isRetryFormOpen && (
        <div className="w-full">
          <div className="rounded-2xl border border-border bg-card p-4">
            <JobRetryForm
              jobId={job.id}
              currentComments={comments}
              onSuccess={onRetrySuccess}
              onCancel={onRetryCancel}
            />
          </div>
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] h-[50vh]">
        <Card className="space-y-3 border border-border shadow-none p-0 h-[50vh] overflow-auto">
          <div className="px-8 mt-2">
            <JobHeaderSection
              job={activeJob}
              maxVersion={maxVersion}
              selectedVersion={selectedVersion}
              onVersionChange={handleVersionChange}
              isReadOnly={!isViewingLatestVersion}
              editForm={editForm}
              titleError={titleError}
              onEditFormChange={handleInlineChangeWithTracking}
              onTitleErrorChange={setTitleError}
              onRepoChange={handleRepoChangeWithTracking}
              jobRepositories={job?.repositories || []}
              onClose={() => {
                flushPendingUpdates();
                onClose?.();
              }}
              onBackClick={() => {
                flushPendingUpdates();
                router.push('/');
              }}
            />
          </div>

          <div className="px-7 pb-2">
            <JobDescription
              job={activeJob}
              generatedDescription={editForm.generated_description}
              onGeneratedDescriptionChange={value =>
                handleInlineChangeWithTracking('generated_description', value)
              }
              isReadOnly={!isViewingLatestVersion}
            />
          </div>

          <div className="px-7 pb-4">
            <JobPullRequest job={activeJob} />
          </div>

          <div className="px-7 pb-4">
            <JobConfigurations
              repositories={activeJob?.repositories || []}
              isReadOnly={!isViewingLatestVersion}
            />
          </div>
        </Card>

        <Card className="space-y-2 border border-border shadow-none p-0 h-[50vh] overflow-hidden">
          <div className="px-2 py-2">
            <JobComments
              jobId={job.id}
              comments={comments}
              currentUserName={currentUserName}
              updates={activeJob.updates || ''}
              isReadOnly={!isViewingLatestVersion}
            />
          </div>
        </Card>
      </div>

      <Card className="w-full border border-border shadow-none pt-2 px-6 ">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle className="text-base font-semibold text-foreground flex flex-wrap items-center gap-2">
            <Logs className="h-4 w-4" />
            <p className="text-lg">Execution logs</p>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-5 pb-5 pt-0">
          <Collapsible
            open={logsOpen.generation}
            onOpenChange={isOpen =>
              setLogsOpen(prev => ({ ...prev, generation: isOpen }))
            }
            className="space-y-2"
          >
            <CollapsibleTrigger asChild>
              <div className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                    <Code className="h-4 w-4 text-primary" />
                  </span>
                  <div className="flex flex-col">
                    <p className="text-sm font-semibold text-foreground">
                      Code generation
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Live stream | Code generation logs
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={e => {
                      e.stopPropagation();
                      const logsContent = Array.isArray(
                        job.code_generation_logs
                      )
                        ? job.code_generation_logs
                            .map(log =>
                              typeof log === 'string'
                                ? log
                                : JSON.stringify(log, null, 2)
                            )
                            .join('\n')
                        : getGenerationLogsContent();
                      navigator.clipboard.writeText(logsContent || '');
                      toast({
                        title: 'Copied to clipboard',
                        description: 'Code Generation Logs have been copied.',
                      });
                    }}
                    disabled={
                      !job.code_generation_logs ||
                      (Array.isArray(job.code_generation_logs) &&
                        job.code_generation_logs.length === 0)
                    }
                  >
                    <Copy className="h-4 w-4" />
                    <span className="sr-only">Copy logs</span>
                  </Button> */}
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronDown className="h-5 w-5 transition-transform duration-200 group-data-[state=open]:-rotate-180" />
                    <span className="sr-only">Toggle logs</span>
                  </Button>
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="transition-all duration-300 ease-in-out data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
              <div className="max-h-[380px] overflow-hidden rounded-lg border border-border/70 bg-sidebar">
                <ScrollArea className="h-[360px]">
                  <StreamingLogsViewer
                    jobId={job.id}
                    jobVersion={activeJob.version}
                    enabled={isModalOpen && logsOpen.generation}
                    useWebSocket={activeJob.status === 'in-progress'}
                    height="360px"
                    initialLogs={
                      Array.isArray(activeJob.code_generation_logs)
                        ? activeJob.code_generation_logs
                        : []
                    }
                  />
                </ScrollArea>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible
            open={logsOpen.verification}
            onOpenChange={isOpen =>
              setLogsOpen(prev => ({ ...prev, verification: isOpen }))
            }
            className="space-y-2"
          >
            <CollapsibleTrigger asChild>
              <div className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  </span>
                  <div className="flex flex-col">
                    <p className="text-sm font-semibold text-foreground">
                      Verification
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Verification logs stream
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={e => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(
                        getVerificationLogsContent() || ''
                      );
                      toast({
                        title: 'Copied to clipboard',
                        description: 'Verification Logs have been copied.',
                      });
                    }}
                    disabled={!getVerificationLogsContent()}
                  >
                    <Copy className="h-4 w-4" />
                    <span className="sr-only">Copy logs</span>
                  </Button> */}
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronDown className="h-5 w-5 transition-transform duration-200 group-data-[state=open]:-rotate-180" />
                    <span className="sr-only">Toggle logs</span>
                  </Button>
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="transition-all duration-300 ease-in-out data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
              <div className="max-h-[380px] overflow-hidden rounded-lg border border-border/70 bg-sidebar">
                <ScrollArea className="h-[360px]">
                  <pre className="p-4 text-xs font-mono text-foreground bg-sidebar">
                    {getVerificationLogsContent() ||
                      'No verification logs yet.'}
                  </pre>
                </ScrollArea>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </div>
  );
}

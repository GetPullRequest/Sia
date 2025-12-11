'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { JobResponse, UpdateJobRequest } from '@/types';
import { Code, ShieldCheck, ChevronDown, Copy, Logs } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { JobHeaderSection } from './job-header-section';
import { JobRetryForm } from './job-retry-form';
import { JobDescription } from './job-description';
import { JobComments } from './job-comments';
import { StreamingLogsViewer } from './streaming-logs-viewer';
import {
  CollapsibleContent,
  CollapsibleTrigger,
  Collapsible,
} from '../ui/collapsible';
import { ScrollArea } from '../ui/scroll-area';
import { useDebouncedCallback } from 'use-debounce';
import { useAuthInfo } from '@propelauth/react';

interface JobDetailProps {
  job: JobResponse;
  isLoading?: boolean;
  onClose?: () => void;
  isModalOpen?: boolean;
  isRetryFormOpen: boolean;
  onRetryCancel: () => void;
  onRetrySuccess: () => void;
}

export function JobDetail({
  job,
  isLoading,
  onClose,
  isModalOpen = true,
  isRetryFormOpen,
  onRetryCancel,
  onRetrySuccess,
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
  const [editForm, setEditForm] = useState({
    generated_name: job?.generated_name || '',
    generated_description: job?.generated_description || '',
    user_input_prompt: job?.user_input?.prompt || '',
    order_in_queue: job?.order_in_queue?.toString() || '',
    repo_id: job?.repo_id || '',
    repo_name: job?.repo_name || '',
  });
  const [titleError, setTitleError] = useState<string>('');

  useEffect(() => {
    setEditForm({
      generated_name: job?.generated_name || '',
      generated_description: job?.generated_description || '',
      user_input_prompt: job?.user_input?.prompt || '',
      order_in_queue: job?.order_in_queue?.toString() || '',
      repo_id: job?.repo_id || '',
      repo_name: job?.repo_name || '',
    });
  }, [
    job?.generated_name,
    job?.generated_description,
    job?.user_input?.prompt,
    job?.order_in_queue,
    job?.repo_id,
    job?.repo_name,
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
    3000
  );

  const handleInlineChange = (field: string, value: string) => {
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
      if (!Number.isNaN(parsedOrder)) {
        updates.order_in_queue = parsedOrder;
      } else {
        return;
      }
    }

    debouncedInlineUpdate(updates);
  };

  const handleRepoChange = (repoName: string) => {
    setEditForm(prev => ({ ...prev, repo_name: repoName }));
    const updates: UpdateJobRequest = {
      updated_by: currentUserName,
      repo: repoName,
    };
    debouncedInlineUpdate(updates);
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading job details…</p>
      </div>
    );
  }

  const comments = Array.isArray(job.user_comments) ? job.user_comments : [];

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

  const getGenerationLogsContent = () => {
    if (Array.isArray(job.code_generation_logs)) {
      return job.code_generation_logs
        .map(log =>
          typeof log === 'string' ? log : JSON.stringify(log, null, 2)
        )
        .join('\n');
    }
    return formatLogs(job.code_generation_logs);
  };

  const getVerificationLogsContent = () =>
    formatLogs(job.code_verification_logs);

  return (
    <div className="  w-full max-w-full flex flex-col justify-top items-start ">
      <div className="grid  lg:grid-cols-2 ">
        <Card className="space-y-3 bg-card min-w-full  max-h-[50vh]  overflow-y-auto ">
          <div className="mt-2">
            <JobHeaderSection
              job={job}
              isEditMode
              editForm={editForm}
              titleError={titleError}
              onEditFormChange={handleInlineChange}
              onTitleErrorChange={setTitleError}
              onRepoChange={handleRepoChange}
              onClose={onClose}
              onBackClick={() => router.push('/')}
            />
          </div>

          <JobDescription
            job={job}
            generatedDescription={editForm.generated_description}
            onGeneratedDescriptionChange={value =>
              handleInlineChange('generated_description', value)
            }
          />

          {isRetryFormOpen && (
            <div className="rounded-2xl bg-card p-6 shadow-inner">
              <JobRetryForm
                jobId={job.id}
                currentComments={comments}
                onSuccess={onRetrySuccess}
                onCancel={onRetryCancel}
              />
            </div>
          )}
        </Card>

        <Card className="space-y-3 min-h-[50vh]  ml-2 min-w-full">
          <JobComments
            jobId={job.id}
            comments={comments}
            currentUserName={currentUserName}
            updates={job.updates || ''}
          />
        </Card>
      </div>

      <Card className="w-full mt-4">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground flex flex-wrap items-center gap-2">
            <Logs className="h-4 w-4" />
            <p>Execution Logs</p>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Collapsible
            open={logsOpen.generation}
            onOpenChange={isOpen =>
              setLogsOpen(prev => ({ ...prev, generation: isOpen }))
            }
            className="space-y-2"
          >
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-4">
              <div className="flex items-center gap-3">
                <Code className="h-5 w-5 text-primary" />
                <p className="font-semibold">Code Generation Logs</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={e => {
                    e.stopPropagation();
                    const logsContent = Array.isArray(job.code_generation_logs)
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
                </Button>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronDown className="h-5 w-5 transition-transform duration-200 group-data-[state=open]:-rotate-180" />
                    <span className="sr-only">Toggle logs</span>
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
            <CollapsibleContent>
              <StreamingLogsViewer
                jobId={job.id}
                jobVersion={job.version}
                enabled={isModalOpen && logsOpen.generation}
                useWebSocket={job.status === 'in-progress'}
                height="600px"
                initialLogs={
                  Array.isArray(job.code_generation_logs)
                    ? job.code_generation_logs
                    : []
                }
              />
            </CollapsibleContent>
          </Collapsible>

          <Collapsible
            open={logsOpen.verification}
            onOpenChange={isOpen =>
              setLogsOpen(prev => ({ ...prev, verification: isOpen }))
            }
            className="space-y-2"
          >
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <p className="font-semibold">Verification Logs</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
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
                </Button>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronDown className="h-5 w-5 transition-transform duration-200 group-data-[state=open]:-rotate-180" />
                    <span className="sr-only">Toggle logs</span>
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
            <CollapsibleContent>
              <div className="rounded-b-lg border border-border/70 border-t-0 bg-sidebar">
                <ScrollArea className="h-[600px]">
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

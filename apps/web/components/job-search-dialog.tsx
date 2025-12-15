'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Command } from 'cmdk';
import { Search, FileText, Clock, Tag } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useJobs } from '@/hooks/use-jobs';
import type { JobResponse } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface JobSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JobSearchDialog({ open, onOpenChange }: JobSearchDialogProps) {
  const [search, setSearch] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: jobs, isLoading } = useJobs();

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  // Filter jobs based on search query
  const filteredJobs = useMemo(() => {
    if (!jobs) return [];

    if (!search) return jobs.slice(0, 10); // Show first 10 jobs when no search

    const query = search.toLowerCase();
    return jobs
      .filter(job => {
        const matchesId = job.id.toLowerCase().includes(query);
        const matchesName = job.generated_name?.toLowerCase().includes(query);
        const matchesDescription = job.generated_description
          ?.toLowerCase()
          .includes(query);
        const matchesPrompt = job.user_input?.prompt
          ?.toLowerCase()
          .includes(query);
        const matchesStatus = job.status.toLowerCase().includes(query);
        const matchesRepo = job.repositories?.[0]?.name
          ?.toLowerCase()
          .includes(query);

        return (
          matchesId ||
          matchesName ||
          matchesDescription ||
          matchesPrompt ||
          matchesStatus ||
          matchesRepo
        );
      })
      .slice(0, 10); // Limit to 10 results
  }, [jobs, search]);

  const openModal = (jobId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    // Get current stack and add this job ID to it
    const currentStack =
      params.get('jobStack')?.split(',').filter(Boolean) || [];
    // Only add if not already the last item in stack (prevent duplicates)
    if (currentStack[currentStack.length - 1] !== jobId) {
      currentStack.push(jobId);
      params.set('jobStack', currentStack.join(','));
      router.push(`?${params.toString()}`, { scroll: false });
    }
  };

  const handleSelectJob = (job: JobResponse) => {
    openModal(job.id);
    onOpenChange(false);
  };

  // Note: We don't render the modal here to avoid conflicts with job cards.
  // Job cards each render their own modal and check if it should be open based on jobStack.
  // When a job is selected from search, we update the URL, and the corresponding job card
  // will handle opening its modal. This prevents duplicate modals and Esc key issues.

  const getStatusColor = (status: JobResponse['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'in-progress':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'queued':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'in-review':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="p-0 gap-0 max-w-2xl overflow-hidden"
          title="Job Search"
        >
          <DialogHeader className="p-3 h-10">
            <DialogTitle>Job Search</DialogTitle>
          </DialogHeader>
          <Command
            className="rounded-lg border-none shadow-none"
            shouldFilter={false}
          >
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Search jobs by name, description, status, or ID..."
                className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <Command.List className="max-h-[400px] overflow-y-auto p-2">
              {isLoading && (
                <Command.Loading>
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Loading jobs...
                  </div>
                </Command.Loading>
              )}

              {!isLoading && filteredJobs.length === 0 && (
                <Command.Empty>
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    {search ? 'No jobs found.' : 'No jobs available.'}
                  </div>
                </Command.Empty>
              )}

              {!isLoading && filteredJobs.length > 0 && (
                <Command.Group heading="Jobs">
                  {filteredJobs.map(job => (
                    <Command.Item
                      key={job.id}
                      value={job.id}
                      onSelect={() => handleSelectJob(job)}
                      className="flex items-start gap-3 rounded-md px-3 py-3 cursor-pointer hover:bg-accent aria-selected:bg-accent"
                    >
                      <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium leading-none truncate">
                            {job.generated_name ||
                              job.user_input?.prompt ||
                              'Untitled Job'}
                          </p>
                          <Badge
                            variant="outline"
                            className={`text-xs ${getStatusColor(job.status)}`}
                          >
                            {job.status}
                          </Badge>
                        </div>
                        {job.generated_description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {job.generated_description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(job.created_at), {
                              addSuffix: true,
                            })}
                          </div>
                          {job.repositories?.[0]?.name && (
                            <div className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              {job.repositories[0].name}
                            </div>
                          )}
                        </div>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

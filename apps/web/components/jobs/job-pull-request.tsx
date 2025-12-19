'use client';

import type { JobResponse } from '@/types';
import { ExternalLink, GitBranch } from 'lucide-react';

interface JobPullRequestProps {
  job: JobResponse;
}

export function JobPullRequest({ job }: JobPullRequestProps) {
  const prLink = job.pr_link;
  const status = job.status;

  // Render only for completed or in-review jobs
  if (status !== 'completed' && status !== 'in-review') {
    return null;
  }

  return (
    <div className="bg-transparent flex flex-row px-4">
      <div className="text-base flex flex-wrap items-center gap-2 text-foreground">
        <GitBranch className="h-4 w-4" />
        <p className="text-base font-medium">Pull Request</p>
      </div>

      <div className="text-sm  rounded-lg bg-card border-none px-5  outline-none flex flex-wrap items-center justify-between gap-2">
        {prLink ? (
          <a
            href={prLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="truncate max-w-[220px]">{prLink}</span>
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">
            No pull requests are available
          </span>
        )}
      </div>
    </div>
  );
}

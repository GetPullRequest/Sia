'use client';

import { useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Play,
  Pause,
  GripVertical,
  Square,
  GitBranch,
  Trash2,
} from 'lucide-react';
import type { JobResponse } from '@/types';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { JobDetailModal } from '../jobs/job-detail-modal';

interface JobCardProps {
  job: JobResponse;
  onStart?: (id: string) => void;
  onPause?: (id: string) => void;
  onCancel?: (id: string) => void;
  onStop?: (id: string) => void;
  onDelete?: (id: string) => void;
  isDraggable?: boolean;
  isClickable?: boolean;
  onCardClick?: (job: JobResponse) => void;
  hideActions?: boolean;
  onDisableLaneAnimation?: () => void;
  onEnableLaneAnimation?: () => void;
  isAnimationDisabled?: boolean;
}

const statusColors: Record<string, string> = {
  queued: 'bg-status-offline',
  'in-progress': 'bg-status-running',
  'in-review': 'bg-status-idle',
  completed: 'bg-status-completed',
  failed: 'bg-status-failed',
};

export function JobCard({
  job,
  onStart,
  onPause,
  onCancel,
  onStop,
  onDelete,
  isDraggable = false,
  isClickable = false,
  onCardClick,
  hideActions = false,
  onDisableLaneAnimation,
  onEnableLaneAnimation,
  isAnimationDisabled = false,
}: JobCardProps) {
  const [hasStoppedAnimation, setHasStoppedAnimation] = useState(false);
  const [dragStartPosition, setDragStartPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get the stack of job IDs from URL (comma-separated)
  const jobStack =
    searchParams.get('jobStack')?.split(',').filter(Boolean) || [];
  // This modal is open if this job ID is the last one in the stack
  const isModalOpen = jobStack[jobStack.length - 1] === job.id;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: job.id, disabled: !isDraggable });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition || undefined,
    touchAction: isDraggable ? 'none' : undefined,
  };

  const interactive = isClickable || Boolean(onCardClick);

  const openModal = () => {
    const params = new URLSearchParams(searchParams.toString());
    // Get current stack and add this job ID to it
    const currentStack =
      params.get('jobStack')?.split(',').filter(Boolean) || [];
    // Only add if not already the last item in stack (prevent duplicates)
    if (currentStack[currentStack.length - 1] !== job.id) {
      currentStack.push(job.id);
      params.set('jobStack', currentStack.join(','));
      router.push(`?${params.toString()}`, { scroll: false });
    }
  };

  const closeModal = () => {
    const params = new URLSearchParams(searchParams.toString());
    // Get current stack and remove the last item
    const currentStack =
      params.get('jobStack')?.split(',').filter(Boolean) || [];
    currentStack.pop();

    if (currentStack.length > 0) {
      params.set('jobStack', currentStack.join(','));
    } else {
      params.delete('jobStack');
    }
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const handleCardAction = (event: MouseEvent) => {
    // Don't navigate if this is a drag operation
    if (isDragging) {
      return;
    }

    // Check if there was actual drag movement (more than 5px)
    if (dragStartPosition) {
      const deltaX = Math.abs(event.clientX - dragStartPosition.x);
      const deltaY = Math.abs(event.clientY - dragStartPosition.y);
      if (deltaX > 5 || deltaY > 5) {
        // This was a drag, not a click
        setDragStartPosition(null);
        return;
      }
      // Clear drag start position after checking
      setDragStartPosition(null);
    }

    // Don't navigate if clicking on interactive elements
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }

    // Prevent default and stop propagation to ensure click works
    event.preventDefault();
    event.stopPropagation();

    // Always open modal on card click (unless it's a drag)
    if (onCardClick) {
      onCardClick(job);
    } else {
      openModal();
    }
  };

  const handleMouseDown = (event: MouseEvent) => {
    if (isDraggable) {
      setDragStartPosition({ x: event.clientX, y: event.clientY });
    }
  };

  const handleMouseUp = (event: MouseEvent) => {
    // If mouse up happens without significant movement, it's a click
    if (dragStartPosition && !isDragging) {
      const deltaX = Math.abs(event.clientX - dragStartPosition.x);
      const deltaY = Math.abs(event.clientY - dragStartPosition.y);
      if (deltaX <= 5 && deltaY <= 5) {
        // It's a click, trigger modal
        const target = event.target as HTMLElement;
        if (!target.closest('button') && !target.closest('a')) {
          if (onCardClick) {
            onCardClick(job);
          } else {
            openModal();
          }
        }
      }
    }
    setDragStartPosition(null);
  };

  const stopPropagation = (event: MouseEvent) => {
    event.stopPropagation();
  };

  const handleJobNameClick = (event: MouseEvent) => {
    event.preventDefault();
    stopPropagation(event);
    openModal();
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
      className={cn(
        'rounded-lg border border-border/80 bg-card backdrop-blur-sm',
        'shadow-sm shadow-black/5',
        'hover:border-border/60 hover:shadow-md hover:shadow-black/10',
        'hover:bg-card/80',
        isDragging && 'opacity-0 pointer-events-none',
        interactive && !isDraggable && 'cursor-pointer',
        isDraggable && 'cursor-grab active:cursor-grabbing',
        !isDraggable && 'cursor-pointer'
      )}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={!isDraggable ? handleCardAction : undefined}
    >
      <CardHeader className="pb-3 px-4 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {isDraggable && (
              <div className="mt-1 text-muted-foreground/60 flex-shrink-0 pointer-events-none">
                <GripVertical className="h-4 w-4" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className={cn(
                    'h-2 w-2 rounded-full flex-shrink-0',
                    statusColors[job.status] || 'bg-gray-400'
                  )}
                />
                <button
                  className="font-semibold text-base text-foreground hover:text-primary transition-colors truncate underline text-left"
                  onClick={handleJobNameClick}
                  onPointerDown={event => event.stopPropagation()}
                >
                  {job.generated_name || 'Untitled Job'}
                </button>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <GitBranch className="h-3 w-3 flex-shrink-0" />
                  {job.repo_url ? (
                    <Link
                      href={job.repo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate hover:text-primary transition-colors underline"
                      onClick={event => event.stopPropagation()}
                      onPointerDown={event => event.stopPropagation()}
                    >
                      {(() => {
                        // Extract org/repo from GitHub URL
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
                      className="truncate hover:text-primary transition-colors underline"
                      onClick={event => event.stopPropagation()}
                      onPointerDown={event => event.stopPropagation()}
                    >
                      @getpullrequest/sia
                    </Link>
                  )}
                </span>
                {/* <span>{job.issueId}</span>
                <Badge variant="outline" className="text-xs">
                  {job.source}
                </Badge> */}
              </div>
            </div>
          </div>
          {job.status !== 'failed' &&
            job.status !== 'in-review' &&
            job.status !== 'completed' && (
              <Badge variant="secondary" className="text-xs flex-shrink-0">
                {job.order_in_queue}
              </Badge>
            )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-4">
        {(job.generated_description || job.user_input?.prompt) && (
          <p className="text-sm text-muted-foreground mb-2 line-clamp-1 leading-relaxed">
            {job.generated_description}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          {/* <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 flex-shrink-0" />
            <span>{formatTime(job.created_at)}</span>
          </span> */}
          {!hideActions && (
            <div className="flex items-center gap-0.5">
              {job.status === 'queued' && onStart && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs hover:bg-accent/50 transition-colors"
                  onClick={event => {
                    stopPropagation(event);
                    onStart(job.id);
                  }}
                >
                  <Play className="h-3 w-3 mr-1" />
                  Start
                </Button>
              )}
              {job.status === 'in-progress' && onPause && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs hover:bg-accent/50 transition-colors"
                  onClick={() => onPause(job.id)}
                >
                  <Pause className="h-3 w-3 mr-1" />
                  Pause
                </Button>
              )}
              {job.status === 'in-progress' &&
                onStart &&
                hasStoppedAnimation && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs hover:bg-accent/50 transition-colors"
                    onClick={event => {
                      stopPropagation(event);
                      onEnableLaneAnimation?.();
                      setHasStoppedAnimation(false);
                      onStart(job.id);
                    }}
                    onPointerDown={event => event.stopPropagation()}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Start
                  </Button>
                )}
              {job.status === 'in-progress' &&
                (onCancel || onStop) &&
                !hasStoppedAnimation && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs hover:bg-accent/50 transition-colors"
                    onClick={event => {
                      stopPropagation(event);
                      onDisableLaneAnimation?.();
                      setHasStoppedAnimation(true);
                      onStop?.(job.id);
                      onCancel?.(job.id);
                    }}
                    onPointerDown={event => event.stopPropagation()}
                  >
                    <Square className="h-3 w-3 mr-1" />
                    Stop
                  </Button>
                )}
              {job.status !== 'in-progress' && onDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs hover:bg-destructive/10 hover:text-destructive transition-colors"
                  onClick={event => {
                    stopPropagation(event);
                    onDelete(job.id);
                  }}
                  onPointerDown={event => event.stopPropagation()}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              )}
              {/* <Button
                size="sm"
                variant="ghost"
                asChild
              >
                <Link href={`/jobs/${job.id}`} onClick={stopPropagation}>
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </Link>
              </Button> */}
            </div>
          )}
        </div>
      </CardContent>
      <JobDetailModal
        jobId={job.id}
        open={isModalOpen}
        onOpenChange={open => {
          if (!open) {
            closeModal();
          }
        }}
      />
    </Card>
  );
}

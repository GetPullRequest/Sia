'use client';

import { useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LayoutGrid, GripVertical } from 'lucide-react';
import type { JobResponse } from '@/types';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
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

const formatTime = (timestamp: string | Date): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) {
    return Math.floor(interval) + 'y ago';
  }
  interval = seconds / 2592000;
  if (interval > 1) {
    return Math.floor(interval) + 'mo ago';
  }
  interval = seconds / 86400;
  if (interval > 1) {
    return Math.floor(interval) + 'd ago';
  }
  interval = seconds / 3600;
  if (interval > 1) {
    return Math.floor(interval) + 'h ago';
  }
  interval = seconds / 60;
  if (interval > 1) {
    return Math.floor(interval) + 'm ago';
  }
  return Math.floor(seconds) + 's ago';
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
  // const [hasStoppedAnimation, setHasStoppedAnimation] = useState(false);
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
        'bg-card rounded-lg shadow-medium p-4',
        isDragging && 'opacity-0 pointer-events-none',
        interactive && !isDraggable && 'cursor-pointer',
        isDraggable && 'cursor-grab active:cursor-grabbing',
        !isDraggable && 'cursor-pointer'
      )}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={!isDraggable ? handleCardAction : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {isDraggable && (
            <div className="mt-1 text-muted-foreground/60 flex-shrink-0 pointer-events-none">
              <GripVertical className="h-4 w-4" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div
                className={cn(
                  'h-2 w-2 rounded-full flex-shrink-0',
                  statusColors[job.status] || 'bg-gray-400'
                )}
              />
              <button
                className="font-semibold text-sm text-foreground hover:text-foreground/70 transition-colors truncate text-left"
                onClick={handleJobNameClick}
                onPointerDown={event => event.stopPropagation()}
              >
                {job.generated_name || 'Untitled Job'}
              </button>
            </div>
          </div>
        </div>
        {job.status !== 'failed' &&
          job.status !== 'in-review' &&
          job.status !== 'completed' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="text-xs flex-shrink-0">
                  {job.order_in_queue || 0}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Current Queue Position: {job.order_in_queue || 0}</p>
              </TooltipContent>
            </Tooltip>
          )}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground ">
        <span className="flex items-center gap-1.5">
          <LayoutGrid className="h-3 w-3 flex-shrink-0" />
          <Link
            href={job.repo_url || 'https://github.com/getpullrequest/sia'}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-primary hover:text-primary transition-colors "
            onClick={event => event.stopPropagation()}
            onPointerDown={event => event.stopPropagation()}
          >
            {job.repo_name || '@getpullrequest/sia'}
          </Link>
        </span>
      </div>

      {(job.generated_description || job.user_input?.prompt) && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-1 leading-relaxed">
          {job.generated_description || job.user_input?.prompt}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 mt-4">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          Created {formatTime(job.created_at)}
        </span>
        {/* <div className="flex items-center gap-0.5">
          {onDelete && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-sm hover:bg-destructive/10 hover:text-destructive transition-colors"
              onClick={event => {
                stopPropagation(event);
                onDelete(job.id);
              }}
              onPointerDown={event => event.stopPropagation()}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-sm hover:bg-accent/50 transition-colors text-muted-foreground"
            onClick={event => {
              stopPropagation(event);
              openModal();
            }}
            onPointerDown={event => event.stopPropagation()}
          >
            <Info className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div> */}
      </div>
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

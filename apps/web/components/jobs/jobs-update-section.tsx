import {
  AlertCircle,
  Clock,
  ChevronDown,
  CheckCircle2,
  FileCheck,
  RotateCw,
} from 'lucide-react';
import { useState } from 'react';
import { Timeline, TimelineItem } from '../ui/timeline';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';

export function JobsUpdateSection({
  updates,
  currentUserName,
}: {
  updates: string;
  currentUserName?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const parseUpdate = (line: string, index: number) => {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();
    const isFailed = lower.includes('failed') || lower.includes('error');
    const isCompleted = lower.includes('completed');
    const isInProgress =
      lower.includes('started') || lower.includes('in-progress');
    const isQueued = lower.includes('queued');
    const isInReview = lower.includes('review');

    let icon = Clock;
    let title = '';
    let status: 'completed' | 'in-progress' | 'pending' = 'completed';
    let iconColor:
      | 'primary'
      | 'secondary'
      | 'muted'
      | 'accent'
      | 'destructive' = 'primary';

    if (isFailed) {
      icon = AlertCircle;
      title = 'Job Failed';
      status = 'completed';
      iconColor = 'destructive';
    } else if (isCompleted) {
      icon = CheckCircle2;
      title = 'Job Completed';
      status = 'completed';
      iconColor = 'primary';
    } else if (isInReview) {
      icon = FileCheck;
      title = 'In Review';
      status = 'in-progress';
      iconColor = 'accent';
    } else if (isInProgress) {
      icon = RotateCw;
      title = 'Execution Started';
      status = 'in-progress';
      iconColor = 'primary';
    } else if (isQueued) {
      icon = Clock;
      title = 'Job Queued';
      status = 'pending';
      iconColor = 'muted';
    } else {
      title = 'Status Updated';
      status = 'completed';
      iconColor = 'primary';
    }

    // Create a date for the timeline item (using relative time from now)
    // Since we don't have exact timestamps, we'll use a relative date
    const date = new Date(Date.now() - index * 60000); // Space updates by 1 minute intervals
    const dateString = date.toISOString();

    return {
      text: trimmed,
      icon,
      title,
      status,
      iconColor,
      date: dateString,
    };
  };

  const lines = updates.split('\n').filter(line => line.trim());
  const parsedUpdates = lines.map((line, index) => parseUpdate(line, index));
  // Updates are already in newest-first order from backend, so we reverse to show oldest first in timeline
  const orderedUpdates = [...parsedUpdates].reverse();
  const visibleUpdates = isExpanded ? orderedUpdates : orderedUpdates.slice(-2); // Show last 2 (most recent)
  const shouldShowExpand = orderedUpdates.length > 2 && !isExpanded;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">
            {(currentUserName || 'You')
              .split(' ')
              .map(part => part.charAt(0))
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-xs font-semibold">
            {currentUserName || 'You'}
          </span>
          <span className="text-[10px] text-muted-foreground">
            Latest activity
          </span>
        </div>
      </div>
      <Timeline size="md" className="min-h-0 max-w-none py-0">
        {visibleUpdates.map((update, index) => {
          const IconComponent = update.icon;
          return (
            <TimelineItem
              key={index}
              date={update.date}
              title={update.title}
              description={update.text}
              icon={<IconComponent className="h-4 w-4" />}
              iconColor={update.iconColor}
              status={update.status}
            />
          );
        })}
      </Timeline>
      {shouldShowExpand && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="text-xs text-muted-foreground hover:text-foreground p-0 h-auto"
        >
          See All Updates
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      )}
      {isExpanded && parsedUpdates.length > 2 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(false)}
          className="text-xs text-muted-foreground hover:text-foreground p-0 h-auto"
        >
          Show Less
          <ChevronDown className="h-3 w-3 ml-1 rotate-180" />
        </Button>
      )}
    </div>
  );
}

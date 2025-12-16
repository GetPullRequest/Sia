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
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useAuthInfo } from '@propelauth/react';

// Update type definition
type Update = {
  message: string;
  timestamp: string;
  status: string;
};

export function JobsUpdateSection({
  updates,
  currentUserName,
}: {
  updates: Update[] | string | null | undefined;
  currentUserName?: string;
}) {
  const { user } = useAuthInfo();
  const [isExpanded, setIsExpanded] = useState(false);

  const getFallbackText = () => {
    if (user) {
      const firstInitial = user.firstName?.[0]?.toUpperCase() || '';
      const lastInitial = user.lastName?.[0]?.toUpperCase() || '';
      if (firstInitial && lastInitial) return `${firstInitial}${lastInitial}`;
      return user.email?.[0]?.toUpperCase() || '?';
    }
    const initials =
      currentUserName
        ?.split(' ')
        .map(part => part.charAt(0))
        .join('')
        .slice(0, 2)
        .toUpperCase() || '';
    return initials || '?';
  };

  const getDisplayName = () => {
    if (user) {
      if (user.firstName && user.lastName) {
        return `${user.firstName} ${user.lastName}`;
      }
      if (user.firstName) return user.firstName;
      return user.email?.split('@')[0] || 'User';
    }
    return currentUserName || 'You';
  };

  // Normalize updates to array format (handle both old string and new array formats)
  const normalizeUpdates = (): Update[] => {
    if (!updates) return [];

    // If it's already an array, use it directly
    if (Array.isArray(updates)) {
      return updates;
    }

    // If it's a string (old format), parse it
    if (typeof updates === 'string') {
      const lines = updates.split('\n').filter(line => line.trim());
      // Try to parse as JSON first (in case it's a stringified array)
      try {
        const parsed = JSON.parse(updates);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // Not JSON, continue with string parsing
      }

      // Convert old string format to new array format
      return lines.map((line, index) => {
        const trimmed = line.trim();
        // Extract status from message (fallback to current job status if not found)
        const lower = trimmed.toLowerCase();
        let status = 'queued'; // default
        if (lower.includes('failed') || lower.includes('error')) {
          status = 'failed';
        } else if (lower.includes('completed')) {
          status = 'completed';
        } else if (lower.includes('in-progress') || lower.includes('started')) {
          status = 'in-progress';
        } else if (lower.includes('review')) {
          status = 'in-review';
        } else if (lower.includes('queued')) {
          status = 'queued';
        }

        // Use approximate timestamp (spaced by index)
        const timestamp = new Date(Date.now() - index * 60000).toISOString();

        return {
          message: trimmed,
          timestamp,
          status,
        };
      });
    }

    return [];
  };

  const parseUpdate = (update: Update, index: number) => {
    const message = update.message.trim();
    const lower = message.toLowerCase();
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

    // Use the status from the update object if available, otherwise infer from message
    const updateStatus = update.status?.toLowerCase() || '';

    if (updateStatus === 'failed' || isFailed) {
      icon = AlertCircle;
      title = 'Job Failed';
      status = 'completed';
      iconColor = 'destructive';
    } else if (updateStatus === 'completed' || isCompleted) {
      icon = CheckCircle2;
      title = 'Job Completed';
      status = 'completed';
      iconColor = 'primary';
    } else if (updateStatus === 'in-review' || isInReview) {
      icon = FileCheck;
      title = 'In Review';
      status = 'in-progress';
      iconColor = 'accent';
    } else if (updateStatus === 'in-progress' || isInProgress) {
      icon = RotateCw;
      title = 'Execution Started';
      status = 'in-progress';
      iconColor = 'primary';
    } else if (updateStatus === 'queued' || isQueued) {
      icon = Clock;
      title = 'Job Queued';
      status = 'pending';
      iconColor = 'muted';
    } else {
      title = 'Status Updated';
      status = 'completed';
      iconColor = 'primary';
    }

    // Use the timestamp from the update object
    const dateString =
      update.timestamp || new Date(Date.now() - index * 60000).toISOString();

    return {
      text: message,
      icon,
      title,
      status,
      iconColor,
      date: dateString,
    };
  };

  const normalizedUpdates = normalizeUpdates();
  const parsedUpdates = normalizedUpdates.map((update, index) =>
    parseUpdate(update, index)
  );
  // Updates are already in newest-first order from backend, so we reverse to show oldest first in timeline
  const orderedUpdates = [...parsedUpdates].reverse();
  const visibleUpdates = isExpanded ? orderedUpdates : orderedUpdates.slice(-2); // Show last 2 (most recent)
  const shouldShowExpand = orderedUpdates.length > 2 && !isExpanded;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={user?.pictureUrl} alt={getDisplayName()} />
          <AvatarFallback className="text-xs">
            {getFallbackText()}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-xs font-semibold">{getDisplayName()}</span>
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
      {isExpanded && normalizedUpdates.length > 2 && (
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

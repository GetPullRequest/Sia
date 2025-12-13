'use client';

import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthInfo } from '@propelauth/react';
import { cn } from '@/lib/utils';
import type { Activity } from '@sia/models';
import { Filter, Search, Clock, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getActivityNameBadge } from './utils';

interface ActivityListProps {
  activities: Activity[];
  selectedActivityId: string | null;
  onSelectActivity: (id: string) => void;
}

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
};

export function ActivityList({
  activities,
  selectedActivityId,
  onSelectActivity,
}: ActivityListProps) {
  const [readFilter, setReadFilter] = useState<'all' | 'read' | 'unread'>(
    'all'
  );
  const [query, setQuery] = useState('');
  const queryClient = useQueryClient();
  const isInitialMount = useRef(true);
  const { user } = useAuthInfo();

  const getFallbackText = (user: any) => {
    if (!user) return '?';
    const firstInitial = user.firstName?.[0]?.toUpperCase() || '';
    const lastInitial = user.lastName?.[0]?.toUpperCase() || '';
    if (firstInitial && lastInitial) return `${firstInitial}${lastInitial}`;
    return user.email?.[0]?.toUpperCase() || '?';
  };

  // Refetch activities when filter changes (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['activities'] });
  }, [readFilter, queryClient]);

  const handleSelectActivity = (id: string) => {
    onSelectActivity(id);
  };

  const filteredActivities = activities
    .filter(activity => {
      if (readFilter === 'read') {
        return activity.read_status === 'read';
      }
      if (readFilter === 'unread') {
        return activity.read_status === 'unread';
      }
      return true;
    })
    .filter(activity => {
      if (!query.trim()) return true;
      const searchQuery = query.toLowerCase().trim();
      const summaryMatch =
        activity.summary?.toLowerCase().includes(searchQuery) ?? false;
      const nameMatch =
        activity.name?.toLowerCase().includes(searchQuery) ?? false;
      return summaryMatch || nameMatch;
    });

  return (
    <div className="h-full flex flex-col ">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Recent Activities
            </h2>
            <p className="text-xs text-muted-foreground">
              {activities.length} activities
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground gap-1.5"
              >
                <Filter className="h-4 w-4" />
                <span className="text-xs capitalize">
                  {readFilter === 'all' ? 'All' : readFilter}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuRadioGroup
                value={readFilter}
                onValueChange={value =>
                  setReadFilter(value as 'all' | 'read' | 'unread')
                }
              >
                <DropdownMenuRadioItem value="all">
                  Show all
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="read">Read</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="unread">
                  Unread
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-3.5 h-4 w-4 text-muted-foreground/70" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search activities..."
            className="h-12 pl-8 pr-8 text-xs"
          />
          {query && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setQuery('')}
              className="absolute right-1 top-1.5 h-9 w-9 p-0 hover:bg-transparent"
            >
              <X className="h-4 w-4 text-muted-foreground/70 hover:text-foreground" />
            </Button>
          )}
        </div>
      </div>

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-2">
        {filteredActivities.map(activity => {
          const isSelected = activity.id === selectedActivityId;
          const nameBadge = getActivityNameBadge(activity.name);
          const isCurrentUser =
            user?.userId && activity.updated_by === user.userId;
          // Dim text for read items when filter is "all"
          const isRead = activity.read_status === 'read';
          const shouldDimText = readFilter === 'all' && isRead;

          return (
            <div
              key={activity.id}
              onClick={() => handleSelectActivity(activity.id)}
              className={cn(
                'cursor-pointer rounded-lg border px-3 py-4 transition-colors',
                'hover:border-border',
                isSelected
                  ? 'bg-secondary text-foreground border-border hover:border-border/30'
                  : 'border-transparent'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  {/* Show unread indicator only for unread items when filter is "unread" or "all" */}
                  {activity.read_status === 'unread' &&
                    (readFilter === 'unread' || readFilter === 'all') && (
                      <span className="mt-1 block h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                  {/* Show avatar for current user's activities */}
                  {isCurrentUser && (
                    <Avatar className="h-8 w-8 border border-border/50 flex-shrink-0">
                      <AvatarImage
                        src={user?.pictureUrl}
                        alt={user?.email || 'User'}
                      />
                      <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">
                        {getFallbackText(user)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex flex-col gap-2 min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm font-medium leading-snug line-clamp-1',
                        shouldDimText
                          ? 'text-muted-foreground'
                          : 'text-foreground'
                      )}
                    >
                      {activity.summary}
                    </p>
                    <span
                      className={cn(
                        'inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-medium leading-none',
                        nameBadge.badge
                      )}
                      title={nameBadge.label}
                    >
                      {nameBadge.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(activity.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredActivities.length === 0 && (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            No recent activity
          </div>
        )}
      </div>
    </div>
  );
}

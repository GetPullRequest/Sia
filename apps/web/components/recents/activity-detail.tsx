'use client';

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Activity } from '@sia/models';
import { cn } from '@/lib/utils';
import {
  GitBranch,
  Code,
  ShieldCheck,
  Copy,
  ChevronDown,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Activity as ActivityIcon,
  FileText,
  Info,
  Terminal,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getActivityNameBadge } from './utils';
import { useAuthInfo } from '@propelauth/react';
import { JobDetailModal } from '@/components/jobs/job-detail-modal';
import { DeleteActivityDialog } from './delete-activity-dialog';
import { useJob } from '@/hooks/use-jobs';

interface ActivityDetailProps {
  activity: Activity;
  onDelete?: () => void;
}

const getActivityIcon = (name: string) => {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('pr') || nameLower.includes('pull request')) {
    return <GitBranch className="h-5 w-5 text-purple-500" />;
  }
  if (nameLower.includes('execution') || nameLower.includes('started')) {
    return <PlayCircle className="h-5 w-5 text-blue-500" />;
  }
  if (nameLower.includes('completed')) {
    return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  }
  if (nameLower.includes('failed')) {
    return <XCircle className="h-5 w-5 text-red-500" />;
  }
  return null;
};

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

const formatDateTime = (value: string | Date) => {
  const date = new Date(value);
  return date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const getActivityIdShort = (id: string) => {
  // Extract the first part before the dash or use the full id
  const parts = id.split('-');
  return parts.length > 0 ? parts[0] : id;
};

// UUID regex pattern
const UUID_REGEX =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Parses the activity summary and replaces user IDs with display names
 * when the ID matches the current user
 */
const parseSummaryWithUserNames = (
  summary: string,
  currentUserId: string | null | undefined,
  getDisplayName: () => string
): string => {
  if (!summary || !currentUserId) {
    return summary;
  }

  // Find all UUIDs in the summary
  const matches = summary.match(UUID_REGEX);
  if (!matches || matches.length === 0) {
    return summary;
  }

  let parsedSummary = summary;

  // Replace each UUID that matches the current user's ID
  matches.forEach(uuid => {
    if (uuid.toLowerCase() === currentUserId.toLowerCase()) {
      const displayName = getDisplayName();
      // Replace the UUID with the display name
      parsedSummary = parsedSummary.replace(uuid, displayName);
    }
  });

  return parsedSummary;
};

export function ActivityDetail({ activity, onDelete }: ActivityDetailProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuthInfo();
  const [logsOpen, setLogsOpen] = useState({
    generation: true,
    verification: false,
  });
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch job details to get job name
  const { data: job } = useJob(activity.job_id || '');

  // Mark activity as read when component mounts
  useEffect(() => {
    if (activity.read_status === 'unread') {
      api
        .updateActivityReadStatus(activity.id, 'read')
        .then(() => {
          // Invalidate activities query to refresh the list
          queryClient.invalidateQueries({ queryKey: ['activities'] });
          queryClient.invalidateQueries({
            queryKey: ['activity', activity.id],
          });
        })
        .catch(error => {
          console.error('Failed to mark activity as read:', error);
        });
    }
  }, [activity.id, activity.read_status, queryClient]);

  const deleteActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      await api.deleteActivity(activityId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({
        queryKey: ['activity', activity.id],
      });
      toast({
        title: 'Activity deleted',
        description: 'The activity has been successfully deleted.',
      });
      setDeleteDialogOpen(false);
      onDelete?.();
    },
    onError: error => {
      console.error('Failed to delete activity:', error);
      toast({
        title: 'Deletion failed',
        description: 'Unable to delete the activity. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleDeleteConfirm = () => {
    deleteActivityMutation.mutate(activity.id);
  };

  const nameBadge = getActivityNameBadge(activity.name);
  const relativeTime = formatTime(activity.updated_at);
  const activityIdShort = getActivityIdShort(activity.id);
  const activityIcon = getActivityIcon(activity.name);

  const getFallbackText = (user: any) => {
    if (!user) return '?';
    const firstInitial = user.firstName?.[0]?.toUpperCase() || '';
    const lastInitial = user.lastName?.[0]?.toUpperCase() || '';
    if (firstInitial && lastInitial) return `${firstInitial}${lastInitial}`;
    return user.email?.[0]?.toUpperCase() || '?';
  };

  const getDisplayName = () => {
    if (!user) return 'User';
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) return user.firstName;
    return user.email?.split('@')[0] || 'User';
  };

  const isCurrentUser = user?.userId && activity.updated_by === user.userId;

  const logSections = [
    {
      key: 'generation',
      title: 'Code Generation Logs',
      content: activity.code_generation_logs,
      placeholder: 'No code generation logs yet.',
      icon: Code,
    },
    {
      key: 'verification',
      title: 'Verification Logs',
      content: activity.verification_logs,
      placeholder: 'No verification logs yet.',
      icon: ShieldCheck,
    },
  ] as const;

  return (
    <div className="h-full bg-background flex flex-col">
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-full mx-auto space-y-6">
          {/* Header Section */}
          <div className="flex items-start justify-between gap-6 w-full">
            <div className="space-y-2">
              <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                Activity Details
              </h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                {activity.job_id && (
                  <>
                    <button
                      onClick={() => setJobModalOpen(true)}
                      className="hover:text-primary text-primary transition-colors  decoration-muted-foreground/40 hover:decoration-primary cursor-pointer"
                    >
                      {activity.job_id}
                    </button>
                    <span className="text-muted-foreground/40">•</span>
                  </>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">{relativeTime}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {formatDateTime(activity.updated_at)}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {activityIcon}
              <div
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium',
                  nameBadge.badge
                )}
              >
                {nameBadge.label}
              </div>
              <Button
                variant="destructive"
                // size="icon"

                className=" bg-none text-white border-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 text-white" />
                <span>Delete activity</span>
              </Button>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Activity Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ActivityIcon className="h-4 w-4 text-muted-foreground" />
                    Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-muted/60 text-muted-foreground/80">
                        AI
                      </span>
                      <span className="text-base text-foreground/90">
                        {activity.name}
                      </span>
                    </div>
                    {/* <p className="text-xs text-foreground/90">
                      {activity.name}
                    </p> */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-xs text-muted-foreground/70 cursor-help">
                          {relativeTime}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent>
                        {formatDateTime(activity.updated_at)}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardContent>
              </Card>

              {/* Summary Card */}
              {activity.summary && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      Description
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      {parseSummaryWithUserNames(
                        activity.summary,
                        user?.userId,
                        getDisplayName
                      )}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Activity Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  Activity Metadata
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-base">
                  <MetadataRow
                    label="Activity ID"
                    value={`evt-${activityIdShort}`}
                  />
                  {/* <MetadataRow label="Type" value={activity.name} /> */}
                  <MetadataRow
                    label="Job"
                    value={
                      activity.job_id ? (
                        <button
                          onClick={() => setJobModalOpen(true)}
                          className="hover:text-primary text-primary transition-colors underline decoration-muted-foreground/40 hover:decoration-primary cursor-pointer font-medium"
                        >
                          {job?.generated_name || activity.job_id}
                        </button>
                      ) : (
                        '—'
                      )
                    }
                  />
                  <MetadataRow
                    label="Updated by"
                    value={
                      isCurrentUser ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 border border-border/50">
                            <AvatarImage
                              src={user?.pictureUrl}
                              alt={getDisplayName()}
                            />
                            <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">
                              {getFallbackText(user)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium text-foreground/90">
                            {getDisplayName()}
                          </span>
                        </div>
                      ) : (
                        activity.updated_by || '—'
                      )
                    }
                  />
                  {/* <MetadataRow
                    label="Created"
                    value={formatDateTime(activity.updated_at)}
                  /> */}
                  <MetadataRow
                    label="Updated time"
                    value={
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">{relativeTime}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {formatDateTime(activity.updated_at)}
                        </TooltipContent>
                      </Tooltip>
                    }
                  />
                </dl>
              </CardContent>
            </Card>
          </div>

          {/* Logs Sections */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                Execution Logs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {logSections.map(section => (
                <Collapsible
                  key={section.key}
                  open={logsOpen[section.key]}
                  onOpenChange={isOpen =>
                    setLogsOpen(prev => ({ ...prev, [section.key]: isOpen }))
                  }
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                    <div className="flex items-center gap-3">
                      <section.icon className="h-5 w-5 text-primary" />
                      <p className="text-sm font-semibold">{section.title}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={e => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(section.content || '');
                          toast({
                            title: 'Copied to clipboard',
                            description: `${section.title} have been copied.`,
                          });
                        }}
                        disabled={!section.content}
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
                    <div className="rounded-b-lg border border-border border-t-0 bg-sidebar">
                      <ScrollArea className="h-full">
                        <pre className="p-4 text-xs font-mono text-foreground bg-sidebar">
                          {section.content || section.placeholder}
                        </pre>
                      </ScrollArea>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      {activity.job_id && (
        <JobDetailModal
          jobId={activity.job_id}
          open={jobModalOpen}
          onOpenChange={setJobModalOpen}
        />
      )}
      <DeleteActivityDialog
        open={deleteDialogOpen}
        activity={activity}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}

function MetadataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-xs text-muted-foreground/70">{label}</dt>
      <dd className="text-xs font-medium text-foreground/90">{value}</dd>
    </div>
  );
}

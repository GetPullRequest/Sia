'use client';

import { useState, useEffect, type MouseEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useAuthInfo } from '@propelauth/react';
import { JobsUpdateSection } from './jobs-update-section';
import { cn } from '@/lib/utils';
import { UserComment } from '@sia/models';
import { formatDateTime } from './job-constants';

// Update type definition
type Update = {
  message: string;
  timestamp: string;
  status: string;
};

interface JobCommentsProps {
  jobId: string;
  comments: UserComment[];
  currentUserName?: string;
  updates?: Update[] | string | null;
}

export function JobComments({
  jobId,
  comments,
  currentUserName,
  updates = [],
}: JobCommentsProps) {
  const [newComment, setNewComment] = useState('');
  const [showUpdates, setShowUpdates] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuthInfo();

  // Detect OS for keyboard shortcut display
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const platform = window.navigator.platform.toLowerCase();
      const userAgent = window.navigator.userAgent.toLowerCase();
      setIsMac(
        platform.includes('mac') ||
          platform.includes('iphone') ||
          platform.includes('ipad') ||
          userAgent.includes('mac')
      );
    }
  }, []);

  const getFallbackText = (user: any) => {
    if (!user) return '?';
    const firstInitial = user.firstName?.[0]?.toUpperCase() || '';
    const lastInitial = user.lastName?.[0]?.toUpperCase() || '';
    if (firstInitial && lastInitial) return `${firstInitial}${lastInitial}`;
    return user.email?.[0]?.toUpperCase() || '?';
  };

  const getDisplayName = () => {
    if (!user) return 'Guest';
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) return user.firstName;
    return user.email?.split('@')[0] || 'User';
  };

  const addCommentMutation = useMutation({
    mutationFn: async (commentText: string) => {
      const newCommentObj: UserComment = {
        file_name: '',
        line_no: 0,
        prompt: commentText,
        created_at: new Date().toISOString(),
      };
      const normalizedExisting = comments.map(c => ({
        file_name: c.file_name ?? '',
        line_no: c.line_no ?? 0,
        prompt: c.prompt,
        created_at: c.created_at ?? '',
      }));
      const result = await api.updateJob(jobId, {
        user_comments: [newCommentObj, ...normalizedExisting],
      });
      if (!result) {
        throw new Error('Failed to add comment');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setNewComment('');
      toast({
        title: 'Comment added',
        description: 'Your comment has been added successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Failed to add comment',
        description: 'Unable to add your comment. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (commentText: string) => {
      return await api.createJob({
        user_input: {
          source: 'mobile',
          prompt: commentText,
          sourceMetadata: null,
        },
        created_by: user?.userId || 'unknown',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setNewComment('');
      toast({
        title: 'Task created',
        description: 'A new task has been created from your comment.',
      });
    },
    onError: () => {
      toast({
        title: 'Failed to create task',
        description: 'Unable to create the task. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSaveClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const trimmedComment = newComment.trim();
    if (!trimmedComment) return;

    if (event.metaKey || event.ctrlKey) {
      createTaskMutation.mutate(trimmedComment);

      return;
    }

    addCommentMutation.mutate(trimmedComment);
  };

  const handleSaveKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    // Prevent Enter key from bubbling up and triggering card clicks or modal reopening
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      const trimmedComment = newComment.trim();
      if (!trimmedComment) {
        event.preventDefault();
        return;
      }

      if (event.metaKey || event.ctrlKey) {
        createTaskMutation.mutate(trimmedComment);

        return;
      }

      addCommentMutation.mutate(trimmedComment);
    }
    // Also stop space key from propagating
    if (event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleSaveKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    // Also prevent Enter key from bubbling up in keyup phase
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleCancelKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>
  ) => {
    // Prevent Enter key from bubbling up
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      setNewComment('');
    }
  };

  const handleCancelKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    // Also prevent Enter key from bubbling up in keyup phase
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleTextareaKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    // Stop space key from propagating to prevent triggering button clicks or modal interactions
    if (event.key === ' ') {
      event.stopPropagation();
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      const trimmedComment = newComment.trim();
      if (!trimmedComment) return;
      addCommentMutation.mutate(trimmedComment);
    }
  };

  return (
    <Card className="bg-transparent shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5" />
          Comments & Activities
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-8 px-3"
          onClick={() => setShowUpdates(prev => !prev)}
          disabled={
            !updates ||
            (Array.isArray(updates) && updates.length === 0) ||
            (typeof updates === 'string' && updates.trim().length === 0)
          }
        >
          {showUpdates ? 'Hide Updates' : 'Show Updates'}
        </Button>
      </CardHeader>
      <CardContent className="max-h-[40vh] overflow-y-auto space-y-3 pt-2">
        {showUpdates && updates && (
          <div className="rounded-lg border border-border bg-card/60 p-3">
            <JobsUpdateSection
              updates={updates as Update[] | string | null | undefined}
              currentUserName={currentUserName}
            />
          </div>
        )}
        <div
          className="space-y-2"
          onKeyDown={e => {
            // Prevent Enter key from bubbling up to parent elements
            if (e.key === 'Enter' && e.target !== e.currentTarget) {
              // Only stop if the event is from a child element, not the container itself
              const target = e.target as HTMLElement;
              if (
                target.tagName === 'BUTTON' ||
                target.tagName === 'TEXTAREA'
              ) {
                e.stopPropagation();
              }
            }
          }}
          onClick={e => {
            // Stop click events from bubbling up
            e.stopPropagation();
          }}
        >
          <Textarea
            placeholder="Write a comment..."
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            className={cn(
              'text-sm min-h-[60px] max-h-[180px] resize-none',
              newComment.trim().length > 0 && 'max-h-[200px] overflow-y-auto'
            )}
          />
          {newComment.trim().length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setNewComment('');
                  }}
                  onKeyDown={handleCancelKeyDown}
                  onKeyUp={handleCancelKeyUp}
                  onMouseDown={e => e.stopPropagation()}
                  onPointerDown={e => e.stopPropagation()}
                  disabled={addCommentMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveClick}
                  onKeyDown={handleSaveKeyDown}
                  onKeyUp={handleSaveKeyUp}
                  onMouseDown={e => e.stopPropagation()}
                  onPointerDown={e => e.stopPropagation()}
                  disabled={
                    addCommentMutation.isPending ||
                    createTaskMutation.isPending ||
                    !newComment.trim()
                  }
                  title="Click to save comment. Hold Ctrl/Cmd while clicking to create a task."
                >
                  {addCommentMutation.isPending ||
                  createTaskMutation.isPending ? (
                    'Saving...'
                  ) : (
                    <>
                      Save{' '}
                      <span className="text-[10px] opacity-70 ml-1">
                        ({isMac ? '⌘' : 'Ctrl'}+Enter)
                      </span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
        {comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              No comments available
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Comments will appear here once added
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment, index) => (
              <div
                key={`comment-${index}`}
                className="group rounded-lg  bg-card p-2 transition-all hover:border-border hover:bg-card/80 hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  {comments.length > 0 && (
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarImage
                        src={user?.pictureUrl}
                        alt={getDisplayName()}
                      />
                      <AvatarFallback className="bg-muted text-muted-foreground text-sm font-semibold">
                        {getFallbackText(user)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex-1 ">
                    {comments.length > 0 && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            {currentUserName || 'You'}
                          </span>
                          {/* {comment.file_name && (
                            <Badge variant="secondary" className="text-xs">
                              {comment.file_name}
                              {comment.line_no ? `:${comment.line_no}` : ''}
                            </Badge>
                          )} */}
                        </div>
                        {/* {comment.created_at && (
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.created_at), {
                              addSuffix: true,
                            })}
                          </span>
                        )} */}
                      </div>
                    )}
                    <p className="text-xs leading-relaxed text-foreground/90">
                      {comment.prompt}
                    </p>
                    {comment.created_at && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatDateTime(comment.created_at)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

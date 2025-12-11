'use client';

import { useState } from 'react';
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

interface JobCommentsProps {
  jobId: string;
  comments: UserComment[];
  currentUserName?: string;
  updates?: string;
}

export function JobComments({
  jobId,
  comments,
  currentUserName,
  updates = '',
}: JobCommentsProps) {
  const [newComment, setNewComment] = useState('');
  const [showUpdates, setShowUpdates] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuthInfo();

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
      };
      const normalizedExisting = comments.map(c => ({
        file_name: c.file_name ?? '',
        line_no: c.line_no ?? 0,
        prompt: c.prompt,
      }));
      const result = await api.updateJob(jobId, {
        user_comments: [...normalizedExisting, newCommentObj],
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

  return (
    <Card className="bg-transparent shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5" />
          Comments & Activities
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-8 px-3"
          onClick={() => setShowUpdates(prev => !prev)}
          disabled={!updates}
        >
          {showUpdates ? 'Hide Updates' : 'Show Updates'}
        </Button>
      </CardHeader>
      <CardContent className="max-h-[300px] overflow-y-auto space-y-3 pt-2">
        {showUpdates && updates && (
          <div className="rounded-lg border border-border bg-card/60 p-3">
            <JobsUpdateSection
              updates={updates}
              currentUserName={currentUserName}
            />
          </div>
        )}
        <div className="space-y-2">
          <Textarea
            placeholder="Write a comment..."
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            className={cn(
              'text-sm min-h-[60px] resize-none',
              newComment.trim().length > 0 && 'max-h-[200px] overflow-y-auto'
            )}
          />
          {newComment.trim().length > 0 && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNewComment('')}
                disabled={addCommentMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => addCommentMutation.mutate(newComment.trim())}
                disabled={addCommentMutation.isPending || !newComment.trim()}
              >
                {addCommentMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
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
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarImage
                      src={user?.pictureUrl}
                      alt={getDisplayName()}
                    />
                    <AvatarFallback className="bg-muted text-muted-foreground text-sm font-semibold">
                      {getFallbackText(user)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 ">
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
                    <p className="text-xs leading-relaxed text-foreground/90">
                      {comment.prompt}
                    </p>
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

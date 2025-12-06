"use client"

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Check, X } from 'lucide-react'

interface JobCommentFormProps {
    jobId: string
    currentComments: Array<{ file_name: string; line_no: number; prompt: string }>
    onSuccess?: () => void
    onCancel?: () => void
}

export function JobCommentForm({
    jobId,
    currentComments,
    onSuccess,
    onCancel,
}: JobCommentFormProps) {
    const [comment, setComment] = useState('')
    const { toast } = useToast()
    const queryClient = useQueryClient()

    const addCommentMutation = useMutation({
        mutationFn: async ({ comment }: { comment: string }) => {
            const newCommentObj = {
                file_name: '',
                line_no: 0,
                prompt: comment,
            }
            const result = await api.updateJob(jobId, {
                user_comments: [...currentComments, newCommentObj],
            })
            if (!result) {
                throw new Error('Failed to add comment')
            }
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job', jobId] })
            queryClient.invalidateQueries({ queryKey: ['jobs'] })
            setComment('')
            toast({
                title: 'Comment added',
                description: 'Your comment has been added successfully.',
            })
            onSuccess?.()
        },
        onError: () => {
            toast({
                title: 'Failed to add comment',
                description: 'Unable to add your comment. Please try again.',
                variant: 'destructive',
            })
        },
    })

    const handleSubmit = () => {
        if (!comment.trim()) {
            toast({
                title: 'Comment required',
                description: 'Please enter a comment before submitting.',
                variant: 'destructive',
            })
            return
        }
        addCommentMutation.mutate({ comment: comment.trim() })
    }

    const handleCancel = () => {
        setComment('')
        onCancel?.()
    }

    return (
        <div className="w-full space-y-4 mt-4 pt-4">
            <div className="space-y-2">
                <label htmlFor="new_comment" className="text-sm font-medium">
                    Add Comment
                </label>
                <Textarea
                    id="new_comment"
                    placeholder="Enter your comment here..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="min-h-[50px] resize-none"
                    autoFocus
                />
            </div>
            <div className="flex justify-end gap-2">
                <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={addCommentMutation.isPending}
                >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    disabled={addCommentMutation.isPending || !comment.trim()}
                >
                    <Check className="h-4 w-4 mr-2" />
                    {addCommentMutation.isPending ? 'Submitting...' : 'Submit Comment'}
                </Button>
            </div>
        </div>
    )
}


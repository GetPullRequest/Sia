"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import type { JobResponse } from '@/types'
import { useAuthInfo } from '@propelauth/react'
import {
    ArrowLeft,
    GitBranch,
    ExternalLink,
    RotateCw,
    X,
    ClipboardList,
    Code,
    ShieldCheck,
    ChevronDown,
    Copy,
    MessageSquarePlus,
    Edit,
    AlertCircle,
    CheckCircle2,
    Clock,
    FileCheck,
} from 'lucide-react'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Timeline, TimelineItem } from '@/components/ui/timeline'
import { StreamingLogsViewer } from './streaming-logs-viewer'

const statusColors: Record<string, string> = {
    queued: 'bg-status-queued',
    'in-progress': 'bg-status-running',
    'in-review': 'bg-status-idle',
    completed: 'bg-status-completed',
    failed: 'bg-status-failed'
}

const acceptanceStyles: Record<
    NonNullable<JobResponse['user_acceptance_status']>,
    string
> = {
    not_reviewed: 'border border-slate-200 bg-slate-50 text-slate-700',
    reviewed_and_accepted: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
    reviewed_and_asked_rework: 'border border-amber-200 bg-amber-50 text-amber-700',
    rejected: 'border border-rose-200 bg-rose-50 text-rose-700',
}

const formatDateTime = (value: string | Date) => new Date(value).toLocaleString()

const formatRelativeTime = (value: string | Date) => {
    const date = new Date(value)
    const diffMs = Date.now() - date.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)

    if (diffMinutes < 60) return `${diffMinutes}m ago`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return `${Math.floor(diffHours / 24)}d ago`
}

function UpdatesSection({ updates }: { updates: string }) {
    const [isExpanded, setIsExpanded] = useState(false)

    const parseUpdate = (line: string, index: number) => {
        const trimmed = line.trim()
        const lower = trimmed.toLowerCase()
        const isFailed = lower.includes('failed') || lower.includes('error')
        const isCompleted = lower.includes('completed')
        const isInProgress = lower.includes('started') || lower.includes('in-progress')
        const isQueued = lower.includes('queued')
        const isInReview = lower.includes('review')

        let icon = Clock
        let title = ''
        let status: 'completed' | 'in-progress' | 'pending' = 'completed'
        let iconColor: 'primary' | 'secondary' | 'muted' | 'accent' | 'destructive' = 'primary'

        if (isFailed) {
            icon = AlertCircle
            title = 'Job Failed'
            status = 'completed'
            iconColor = 'destructive'
        } else if (isCompleted) {
            icon = CheckCircle2
            title = 'Job Completed'
            status = 'completed'
            iconColor = 'primary'
        } else if (isInReview) {
            icon = FileCheck
            title = 'In Review'
            status = 'in-progress'
            iconColor = 'accent'
        } else if (isInProgress) {
            icon = RotateCw
            title = 'Execution Started'
            status = 'in-progress'
            iconColor = 'primary'
        } else if (isQueued) {
            icon = Clock
            title = 'Job Queued'
            status = 'pending'
            iconColor = 'muted'
        } else {
            title = 'Status Updated'
            status = 'completed'
            iconColor = 'primary'
        }

        // Create a date for the timeline item (using relative time from now)
        // Since we don't have exact timestamps, we'll use a relative date
        const date = new Date(Date.now() - (index * 60000)) // Space updates by 1 minute intervals
        const dateString = date.toISOString()

        return {
            text: trimmed,
            icon,
            title,
            status,
            iconColor,
            date: dateString,
        }
    }

    const lines = updates.split('\n').filter(line => line.trim())
    const parsedUpdates = lines.map((line, index) => parseUpdate(line, index))
    // Updates are already in newest-first order from backend, so we reverse to show oldest first in timeline
    const orderedUpdates = [...parsedUpdates].reverse()
    const visibleUpdates = isExpanded ? orderedUpdates : orderedUpdates.slice(-2) // Show last 2 (most recent)
    const shouldShowExpand = orderedUpdates.length > 2 && !isExpanded

    return (
        <div className="space-y-4">
            <Timeline size="md" className="min-h-0 max-w-none py-0">
                {visibleUpdates.map((update, index) => {
                    const IconComponent = update.icon
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
                    )
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
    )
}

type StatusUpdate = 'queued' | 'in-progress' | 'completed' | 'failed' | 'archived'

interface JobDetailProps {
    job: JobResponse
    isLoading?: boolean
    onClose?: () => void
    isModalOpen?: boolean
}

export function JobDetail({ job, isLoading, onClose, isModalOpen = true }: JobDetailProps) {
    const router = useRouter()
    const { toast } = useToast()
    const queryClient = useQueryClient()
    const authInfo = useAuthInfo()
    const [logsOpen, setLogsOpen] = useState({
        generation: true,
        verification: false,
    })
    const [isCommentModalOpen, setIsCommentModalOpen] = useState(false)
    const [newComment, setNewComment] = useState('')
    const [isRetryModalOpen, setIsRetryModalOpen] = useState(false)
    const [retryComment, setRetryComment] = useState('')
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editForm, setEditForm] = useState({
        generated_name: job?.generated_name || '',
        generated_description: job?.generated_description || '',
        user_input_prompt: job?.user_input?.prompt || '',
        order_in_queue: job?.order_in_queue?.toString() || '',
        repo_id: job?.repo_id || '',
        repo_name: job?.repo_name || '',
    })
    const [isLoadingRepos, setIsLoadingRepos] = useState(false)
    const [availableRepos, setAvailableRepos] = useState<Array<{ id: string; name: string; url: string }>>([])
    const [selectedProviderId, setSelectedProviderId] = useState<string>('')

    const updateStatusMutation = useMutation({
        mutationFn: async ({ status }: { status: StatusUpdate }) => {
            const result = await api.updateJobStatus(job.id, status)
            if (!result) {
                throw new Error('Failed to update job status')
            }
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job', job.id] })
            queryClient.invalidateQueries({ queryKey: ['jobs'] })
            toast({
                title: 'Status updated',
                description: 'The job status has been updated successfully.',
            })
        },
        onError: () => {
            toast({
                title: 'Update failed',
                description: 'Unable to update the job status. Please try again.',
                variant: 'destructive',
            })
        },
    })

    const retryMutation = useMutation({
        mutationFn: async ({ comment }: { comment: string }) => {
            const currentComments = job?.user_comments || []
            const newCommentObj = {
                file_name: '',
                line_no: 0,
                prompt: comment,
            }
            const result = await api.updateJob(job.id, {
                status: 'queued',
                queue_type: 'rework',
                user_comments: [...currentComments, newCommentObj],
            })
            if (!result) {
                throw new Error('Failed to retry job')
            }
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job', job.id] })
            queryClient.invalidateQueries({ queryKey: ['jobs'] })
            setIsRetryModalOpen(false)
            setRetryComment('')
            toast({
                title: 'Job queued for retry',
                description: 'The job has been added to the rework queue.',
            })
        },
        onError: () => {
            toast({
                title: 'Retry failed',
                description: 'Unable to retry the job. Please try again.',
                variant: 'destructive',
            })
        },
    })

    const handleRetry = () => setIsRetryModalOpen(true)
    const handleRetrySubmit = () => {
        retryMutation.mutate({ comment: retryComment.trim() })
    }
    const handleCancel = () => updateStatusMutation.mutate({ status: 'failed' })

    const addCommentMutation = useMutation({
        mutationFn: async ({ comment }: { comment: string }) => {
            const currentComments = job?.user_comments || []
            const newCommentObj = {
                file_name: '',
                line_no: 0,
                prompt: comment,
            }
            const result = await api.updateJob(job.id, {
                user_comments: [...currentComments, newCommentObj],
            })
            if (!result) {
                throw new Error('Failed to add comment')
            }
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job', job.id] })
            setIsCommentModalOpen(false)
            setNewComment('')
            toast({
                title: 'Comment added',
                description: 'Your comment has been added successfully.',
            })
        },
        onError: () => {
            toast({
                title: 'Failed to add comment',
                description: 'Unable to add your comment. Please try again.',
                variant: 'destructive',
            })
        },
    })

    const updateJobMutation = useMutation({
        mutationFn: async (updates: {
            generated_name?: string
            generated_description?: string
            user_input?: { source: 'slack' | 'discord' | 'mobile' | 'gh-issues'; prompt: string }
            order_in_queue?: number
            repo?: string
        }) => {
            const userId = authInfo.user?.userId || 'sia-system'
            const userName = authInfo.user?.firstName && authInfo.user?.lastName
                ? `${authInfo.user.firstName} ${authInfo.user.lastName}`
                : authInfo.user?.email?.split('@')[0] || 'User'
            const updatedBy = `${userName} (${userId})`

            const result = await api.updateJob(job.id, {
                ...updates,
                updated_by: updatedBy,
            } as Parameters<typeof api.updateJob>[1])
            if (!result) {
                throw new Error('Failed to update job')
            }
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job', job.id] })
            queryClient.invalidateQueries({ queryKey: ['jobs'] })
            setIsEditModalOpen(false)
            toast({
                title: 'Job updated',
                description: 'The job has been updated successfully.',
            })
        },
        onError: () => {
            toast({
                title: 'Update failed',
                description: 'Unable to update the job. Please try again.',
                variant: 'destructive',
            })
        },
    })

    useEffect(() => {
        const loadRepos = async (providerId: string) => {
            setIsLoadingRepos(true)
            try {
                const repos = await api.getGitHubRepos(providerId)
                setAvailableRepos(repos.map((repo) => ({
                    id: repo.id,
                    name: repo.name,
                    url: repo.url,
                })))
            } catch (error) {
                console.error('Failed to load repos:', error)
                toast({
                    title: 'Failed to load repos',
                    description: 'Unable to load repositories. Please try again.',
                    variant: 'destructive',
                })
            } finally {
                setIsLoadingRepos(false)
            }
        }

        if (selectedProviderId && isEditModalOpen) {
            loadRepos(selectedProviderId)
        }
    }, [selectedProviderId, isEditModalOpen, toast])

    const handleEditOpen = async () => {
        setEditForm({
            generated_name: job?.generated_name || '',
            generated_description: job?.generated_description || '',
            user_input_prompt: job?.user_input?.prompt || '',
            order_in_queue: job?.order_in_queue?.toString() || '',
            repo_id: job?.repo_id || '',
            repo_name: job?.repo_name || '',
        })
        setIsEditModalOpen(true)

        // Load GitHub providers and repos
        try {
            const providers = await api.getGitHubProviders()
            if (providers.length > 0) {
                const firstProviderId = providers[0].id
                setSelectedProviderId(firstProviderId)
            }
        } catch (error) {
            console.error('Failed to load providers:', error)
        }
    }

    const handleEditSubmit = () => {
        const updates: {
            generated_name?: string
            generated_description?: string
            user_input?: { source: 'slack' | 'discord' | 'mobile' | 'gh-issues'; prompt: string }
            order_in_queue?: number
            repo?: string
        } = {}

        if (editForm.generated_name !== job?.generated_name) {
            updates.generated_name = editForm.generated_name
        }
        if (editForm.generated_description !== job?.generated_description) {
            updates.generated_description = editForm.generated_description
        }
        if (editForm.user_input_prompt !== job?.user_input?.prompt) {
            updates.user_input = {
                source: (job?.user_input?.source || 'mobile') as 'slack' | 'discord' | 'mobile' | 'gh-issues',
                prompt: editForm.user_input_prompt,
            }
        }
        if (editForm.order_in_queue !== job?.order_in_queue?.toString()) {
            const orderValue = parseInt(editForm.order_in_queue, 10)
            if (!isNaN(orderValue)) {
                updates.order_in_queue = orderValue
            }
        }
        if (editForm.repo_name !== job?.repo_name) {
            // Find the repo ID from the selected repo name
            const selectedRepo = availableRepos.find((repo) => repo.name === editForm.repo_name)
            if (selectedRepo) {
                updates.repo = selectedRepo.id
            } else if (!editForm.repo_name) {
                // If no repo selected, clear it
                updates.repo = undefined
            }
        }

        if (Object.keys(updates).length === 0) {
            toast({
                title: 'No changes',
                description: 'No changes were made to the job.',
            })
            return
        }

        updateJobMutation.mutate(updates)
    }

    const handleSubmitComment = () => {
        if (!newComment.trim()) {
            toast({
                title: 'Comment required',
                description: 'Please enter a comment before submitting.',
                variant: 'destructive',
            })
            return
        }
        addCommentMutation.mutate({ comment: newComment.trim() })
    }

    if (isLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <p className="text-muted-foreground">Loading job details…</p>
            </div>
        )
    }

    const comments = Array.isArray(job.user_comments) ? job.user_comments : []
    const acceptanceStatus = job.user_acceptance_status ?? 'not_reviewed'

    const metadataItems = [
        // { label: 'Job ID', value: job.id },
        { label: 'Version', value: job.version },
        { label: 'Created By', value: job.created_by || '—' },
        { label: 'Created', value: formatDateTime(job.created_at) },
        { label: 'Last Updated', value: formatDateTime(job.updated_at) },
    ]

    // Helper function to format JSON logs to string
    const formatLogs = (logs: unknown): string => {
        if (!logs) return '';
        if (typeof logs === 'string') return logs; // Backward compatibility
        if (Array.isArray(logs)) {
            return logs
                .map((log: { level?: string; timestamp?: string; message?: string }) => {
                    const timestamp = log.timestamp ? new Date(log.timestamp).toLocaleString() : '';
                    const level = log.level?.toUpperCase() || 'INFO';
                    const message = log.message || '';
                    return `[${timestamp}] ${level} ${message}`;
                })
                .join('\n');
        }
        return '';
    };

    const logSections = [
        {
            key: 'generation',
            title: 'Code Generation Logs',
            content: formatLogs(job.code_generation_logs),
            placeholder: 'No code generation logs yet.',
            icon: Code,
        },
        {
            key: 'verification',
            title: 'Verification Logs',
            content: formatLogs(job.code_verification_logs),
            placeholder: 'No verification logs yet.',
            icon: ShieldCheck,
        },
    ] as const

    return (
        <div className="space-y-8 w-full max-w-6xl mx-auto">
            <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-lg shadow-black/5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-3">
                        {!onClose && (
                            <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Home
                            </Button>
                        )}
                        <div className="flex items-center gap-3">
                            <span
                                className={cn(
                                    'h-3 w-3 rounded-full',
                                    statusColors[job.status] || 'bg-muted-foreground'
                                )}
                            />
                            <div>
                                <h1 className="text-2xl font-semibold">
                                    {job?.generated_name || 'Untitled Job'}
                                </h1>
                                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                    {job.repo_url ? (
                                        <Link
                                            href={job.repo_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 hover:text-primary transition-colors underline"
                                        >
                                            <GitBranch className="h-4 w-4" />
                                            {(() => {
                                                // Extract org/repo from GitHub URL
                                                try {
                                                    const url = new URL(job.repo_url);
                                                    if (url.hostname.includes('github.com')) {
                                                        const parts = url.pathname.split('/').filter(Boolean);
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
                                            className="flex items-center gap-1 hover:text-primary transition-colors underline"
                                        >
                                            <GitBranch className="h-4 w-4" />
                                            @getpullrequest/sia
                                        </Link>
                                    )}

                                    {job.user_input?.source && (
                                        <>
                                            <Separator orientation="vertical" className="h-4" />
                                            <span className="capitalize">{job.user_input.source}</span>
                                        </>
                                    )}
                                    {job.status === 'queued' && job.order_in_queue !== undefined && (
                                        <>
                                            <Separator orientation="vertical" className="h-4" />
                                            <span>Order: {job.order_in_queue}</span>
                                        </>
                                    )}
                                    <Separator orientation="vertical" className="h-4" />
                                    <span>Updated {formatRelativeTime(job.updated_at)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge className="capitalize">{job.status}</Badge>
                        <Badge variant="secondary" className="capitalize">
                            {job.priority}
                        </Badge>
                        {job.status === 'in-review' && (
                            <Badge className={cn('capitalize', acceptanceStyles[acceptanceStatus])}>
                                {acceptanceStatus.replace(/_/g, ' ')}
                            </Badge>
                        )}
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                    <Popover open={isEditModalOpen} onOpenChange={setIsEditModalOpen} modal={true}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" onClick={handleEditOpen}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Job
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            className="w-[600px] max-h-[90vh] overflow-y-auto p-6"
                            align="start"
                            side="right"
                            sideOffset={8}
                        >
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-lg font-semibold mb-1">Edit Job</h3>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Update the job details below.
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label htmlFor="generated_name" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            Title
                                        </label>
                                        <Input
                                            id="generated_name"
                                            value={editForm.generated_name}
                                            onChange={(e) => setEditForm({ ...editForm, generated_name: e.target.value })}
                                            placeholder="Job title"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="generated_description" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            Summary
                                        </label>
                                        <Textarea
                                            id="generated_description"
                                            value={editForm.generated_description}
                                            onChange={(e) => setEditForm({ ...editForm, generated_description: e.target.value })}
                                            placeholder="Job summary"
                                            className="min-h-[100px] resize-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="user_input_prompt" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            User Input
                                        </label>
                                        <Textarea
                                            id="user_input_prompt"
                                            value={editForm.user_input_prompt}
                                            onChange={(e) => setEditForm({ ...editForm, user_input_prompt: e.target.value })}
                                            placeholder="User input prompt"
                                            className="min-h-[100px] resize-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="order_in_queue" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            Order in Queue
                                        </label>
                                        <Input
                                            id="order_in_queue"
                                            type="number"
                                            value={editForm.order_in_queue}
                                            onChange={(e) => setEditForm({ ...editForm, order_in_queue: e.target.value })}
                                            placeholder="Queue position"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="repo" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            Repository
                                        </label>
                                        {selectedProviderId ? (
                                            <select
                                                id="repo"
                                                value={editForm.repo_name}
                                                onChange={(e) => setEditForm({ ...editForm, repo_name: e.target.value })}
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                disabled={isLoadingRepos}
                                            >
                                                {isLoadingRepos ? (
                                                    <option value="">Loading repos...</option>
                                                ) : availableRepos.length === 0 ? (
                                                    <option value="">No repositories available</option>
                                                ) : (
                                                    <>
                                                        <option value="">No repository (use default)</option>
                                                        {availableRepos.map((repo) => (
                                                            <option key={repo.id} value={repo.name}>
                                                                {repo.name}
                                                            </option>
                                                        ))}
                                                    </>
                                                )}
                                            </select>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                No GitHub providers connected. Please connect a GitHub provider first.
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-4 border-t">
                                    <Button
                                        variant="outline"
                                        onClick={() => setIsEditModalOpen(false)}
                                        disabled={updateJobMutation.isPending}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleEditSubmit}
                                        disabled={updateJobMutation.isPending}
                                    >
                                        {updateJobMutation.isPending ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <Popover open={isCommentModalOpen} onOpenChange={setIsCommentModalOpen}>
                        <PopoverTrigger asChild>
                            <Button>
                                <MessageSquarePlus className="h-4 w-4 mr-2" />
                                Add Comment
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            className="w-[500px] p-6"
                            align="start"
                            side="bottom"
                            sideOffset={8}
                        >
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-lg font-semibold mb-1">Add Comment</h3>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Share your thoughts or feedback about this job.
                                    </p>
                                </div>
                                <Textarea
                                    placeholder="Enter your comment here..."
                                    value={newComment}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewComment(e.target.value)}
                                    className="min-h-[120px] resize-none"
                                    autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setIsCommentModalOpen(false)
                                            setNewComment('')
                                        }}
                                        disabled={addCommentMutation.isPending}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleSubmitComment}
                                        disabled={addCommentMutation.isPending}
                                    >
                                        {addCommentMutation.isPending ? 'Submitting...' : 'Submit'}
                                    </Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {(job.status === 'failed' || job.status === 'completed') && (
                        <Popover open={isRetryModalOpen} onOpenChange={setIsRetryModalOpen}>
                            <PopoverTrigger asChild>
                                <Button onClick={handleRetry} disabled={retryMutation.isPending}>
                                    <RotateCw className="h-4 w-4 mr-2" />
                                    Retry
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent
                                className="w-[500px] p-6"
                                align="start"
                                side="bottom"
                                sideOffset={8}
                            >
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-lg font-semibold mb-1">Retry Job</h3>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            Add a comment about why you&apos;re retrying this job. The job will be added to the rework queue.
                                        </p>
                                    </div>
                                    <Textarea
                                        placeholder="Enter your comment here (optional)..."
                                        value={retryComment}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRetryComment(e.target.value)}
                                        className="min-h-[120px] resize-none"
                                        autoFocus
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setIsRetryModalOpen(false)
                                                setRetryComment('')
                                            }}
                                            disabled={retryMutation.isPending}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleRetrySubmit}
                                            disabled={retryMutation.isPending}
                                        >
                                            {retryMutation.isPending ? 'Retrying...' : 'Retry Job'}
                                        </Button>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                    {(job.status === 'queued' || job.status === 'in-progress') && (
                        <Button
                            variant="destructive"
                            onClick={handleCancel}
                            disabled={updateStatusMutation.isPending}
                        >
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
                <div className="space-y-6 xl:col-span-2">
                    {job.updates && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Updates</CardTitle>
                            </CardHeader>
                            <CardContent className="max-h-[400px] overflow-y-auto">
                                <UpdatesSection updates={job.updates} />
                            </CardContent>
                        </Card>
                    )}
                    <Card>
                        <CardHeader>
                            <CardTitle>Description</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 max-h-[400px] overflow-y-auto">
                            <p className="text-muted-foreground text-base leading-relaxed">
                                {job.generated_description ||
                                    job.user_input?.prompt ||
                                    'No description provided for this job.'}
                            </p>
                            <div className="rounded-2xl border border-dashed border-muted p-4">
                                <p className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                                    <ClipboardList className="h-4 w-4" />
                                    User Input
                                </p>
                                {job.user_input ? (
                                    <div className="space-y-1 text-sm">
                                        <p className="text-muted-foreground">
                                            <span className="font-medium">Source:</span>{' '}
                                            {job.user_input.source}
                                        </p>
                                        <p>{job.user_input.prompt}</p>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No user input was attached to this job.
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Execution Logs</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4  max-h-[500px] overflow-y-auto">
                            <Collapsible
                                open={logsOpen.generation}
                                onOpenChange={(isOpen) =>
                                    setLogsOpen((prev) => ({ ...prev, generation: isOpen }))
                                }
                                className="space-y-2"
                            >
                                <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <Code className="h-5 w-5 text-primary" />
                                        <p className="font-semibold">Code Generation Logs</p>
                                    </div>
                                    <CollapsibleTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <ChevronDown className="h-5 w-5 transition-transform duration-200 group-data-[state=open]:-rotate-180" />
                                            <span className="sr-only">Toggle logs</span>
                                        </Button>
                                    </CollapsibleTrigger>
                                </div>
                                <CollapsibleContent>
                                    <StreamingLogsViewer
                                        jobId={job.id}
                                        jobVersion={job.version}
                                        enabled={isModalOpen && logsOpen.generation}
                                        useWebSocket={job.status === 'in-progress'}
                                        height="600px"
                                        initialLogs={Array.isArray(job.code_generation_logs) ? job.code_generation_logs : []}
                                    />
                                </CollapsibleContent>
                            </Collapsible>
                            
                            {logSections
                                .filter((section) => section.key === 'verification')
                                .map((section) => (
                                    <Collapsible
                                        key={section.key}
                                        open={logsOpen[section.key]}
                                        onOpenChange={(isOpen) =>
                                            setLogsOpen((prev) => ({ ...prev, [section.key]: isOpen }))
                                        }
                                        className="space-y-2"
                                    >
                                        <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <section.icon className="h-5 w-5 text-primary" />
                                                <p className="font-semibold">{section.title}</p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        navigator.clipboard.writeText(section.content || '')
                                                        toast({
                                                            title: 'Copied to clipboard',
                                                            description: `${section.title} have been copied.`,
                                                        })
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
                                            <div className="rounded-b-lg border border-border/70 border-t-0 bg-sidebar">
                                                <ScrollArea className="h-full">
                                                    <pre className=" p-4 text-xs font-mono text-foreground bg-sidebar">
                                                        {section.content || section.placeholder}
                                                    </pre>
                                                </ScrollArea>
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
                                ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>User Comments</CardTitle>
                        </CardHeader>
                        <CardContent className="max-h-[400px] overflow-y-auto">
                            {comments.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No comments have been added for this job yet.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {comments.map((comment: { file_name: string; line_no: number; prompt: string }, index: number) => (
                                        <div
                                            key={`comment-${index}`}
                                            className="rounded-2xl border border-border/60 bg-card/60 p-4"
                                        >
                                            <p className="text-sm leading-relaxed">{comment.prompt ?? '—'}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Job Metadata</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 max-h-[300px] overflow-y-auto">
                            {metadataItems.map((item) => (
                                <div key={item.label} className="flex items-center justify-between">
                                    <p className="text-sm text-muted-foreground">{item.label}</p>
                                    <p className="text-sm font-medium text-foreground">{item.value ?? '—'}</p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Pull Request</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 max-h-[300px] overflow-y-auto">
                            <Button
                                variant="outline"
                                className="w-full flex flex-row items-center"
                                disabled={!job.pr_link}
                            >
                                <a
                                    href={job.pr_link || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className='flex flex-row items-center'
                                    aria-disabled={!job.pr_link}
                                >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    {job.pr_link ? 'View PR' : 'PR not available'}
                                </a>
                            </Button>
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Confidence Score</p>
                                <p className="text-3xl font-semibold">
                                    {job.confidence_score ?? '—'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

        </div>
    )
}

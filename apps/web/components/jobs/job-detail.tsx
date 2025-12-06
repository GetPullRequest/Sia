"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import type { JobResponse } from '@/types'
import {
    Code,
    ShieldCheck,
    ChevronDown,
    Copy,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { JobsUpdateSection } from './jobs-update-section'
import { JobHeaderSection } from './job-header-section'
import { JobEditForm } from './job-edit-form'
import { JobCommentForm } from './job-comment-form'
import { JobRetryForm } from './job-retry-form'
import { JobDescription } from './job-description'
// import { JobLogs } from './job-logs'
import { JobComments } from './job-comments'
import { JobMetadata } from './job-metadata'
import { JobPullRequest } from './job-pull-request'
import { formatDateTime } from './job-constants'
import { StreamingLogsViewer } from './streaming-logs-viewer'
import { CollapsibleContent, CollapsibleTrigger, Collapsible } from '../ui/collapsible'
import { ScrollArea } from '../ui/scroll-area'
import { Edit, MessageSquarePlus, RotateCw, X } from 'lucide-react'

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
    const [logsOpen, setLogsOpen] = useState({
        generation: true,
        verification: false,
    })
    const [isCommentFormOpen, setIsCommentFormOpen] = useState(false)
    const [isRetryFormOpen, setIsRetryFormOpen] = useState(false)
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
    const [titleError, setTitleError] = useState<string>('')

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

    const handleRetryOpen = () => setIsRetryFormOpen(true)
    const handleRetryCancel = () => setIsRetryFormOpen(false)
    const handleRetrySuccess = () => setIsRetryFormOpen(false)
    const handleCancel = () => updateStatusMutation.mutate({ status: 'failed' })

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

    const handleEditCancel = () => {
        setIsEditModalOpen(false)
        setTitleError('')
        // Reset form to original values
        setEditForm({
            generated_name: job?.generated_name || '',
            generated_description: job?.generated_description || '',
            user_input_prompt: job?.user_input?.prompt || '',
            order_in_queue: job?.order_in_queue?.toString() || '',
            repo_id: job?.repo_id || '',
            repo_name: job?.repo_name || '',
        })
    }

    const handleEditSuccess = () => {
        setIsEditModalOpen(false)
        setTitleError('')
    }

    const handleCommentCancel = () => {
        setIsCommentFormOpen(false)
    }

    const handleCommentOpen = () => {
        setIsCommentFormOpen(true)
    }

    const handleCommentSuccess = () => {
        setIsCommentFormOpen(false)
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

    const handleEditFormChange = (field: string, value: string) => {
        setEditForm((prev) => ({ ...prev, [field]: value }))
    }

    // const handleLogsToggle = (key: string, isOpen: boolean) => {
    //     setLogsOpen((prev) => ({ ...prev, [key]: isOpen }))
    // }

    // const handleCopyLogs = (content: string, title: string) => {
    //     navigator.clipboard.writeText(content)
    //     toast({
    //         title: 'Copied to clipboard',
    //         description: `${title} have been copied.`,
    //     })
    // }

    return (
        <div className="space-y-8 w-full max-w-6xl mx-auto">
            <div>
                {/* Action Buttons at the top */}
                <div className="mb-4 flex flex-wrap justify-end gap-3">
                    {!isEditModalOpen && !isCommentFormOpen && !isRetryFormOpen && (
                        <Button variant="outline" onClick={handleEditOpen}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Job
                        </Button>
                    )}

                    {!isEditModalOpen && !isCommentFormOpen && !isRetryFormOpen && (
                        <Button onClick={handleCommentOpen}>
                            <MessageSquarePlus className="h-4 w-4 mr-2" />
                            Add Comment
                        </Button>
                    )}

                    {(job.status === 'failed' || job.status === 'completed') && !isEditModalOpen && !isCommentFormOpen && !isRetryFormOpen && (
                        <Button onClick={handleRetryOpen}>
                            <RotateCw className="h-4 w-4 mr-2" />
                            Retry
                        </Button>
                    )}
                    {(job.status === 'queued' || job.status === 'in-progress') && !isEditModalOpen && !isCommentFormOpen && !isRetryFormOpen && (
                        <Button
                            variant="destructive"
                            onClick={handleCancel}
                            disabled={updateStatusMutation.isPending}
                        >
                            <X className="h-4 w-4 mr-2" />
                            Cancel job
                        </Button>
                    )}
                </div>

                <JobHeaderSection
                    job={job}
                    isEditMode={isEditModalOpen}
                    editForm={editForm}
                    titleError={titleError}
                    selectedProviderId={selectedProviderId}
                    isLoadingRepos={isLoadingRepos}
                    availableRepos={availableRepos}
                    onEditFormChange={handleEditFormChange}
                    onTitleErrorChange={setTitleError}
                    acceptanceStatus={acceptanceStatus}
                    onClose={onClose}
                    onBackClick={() => router.push('/')}
                />
                {isEditModalOpen && (
                    <div className="rounded-3xl bg-card p-6 shadow-lg shadow-black/5 -mt-8 pt-8">
                        <JobEditForm
                            job={job}
                            editForm={editForm}
                            userInputSource={job.user_input?.source}
                            availableRepos={availableRepos}
                            titleError={titleError}
                            onEditFormChange={handleEditFormChange}
                            onTitleErrorChange={setTitleError}
                            onSuccess={handleEditSuccess}
                            onCancel={handleEditCancel}
                        />
                    </div>
                )}
                {isCommentFormOpen && (
                    <div className="rounded-3xl bg-card p-6 shadow-lg shadow-black/5 -mt-8 pt-8">
                        <JobCommentForm
                            jobId={job.id}
                            currentComments={comments}
                            onSuccess={handleCommentSuccess}
                            onCancel={handleCommentCancel}
                        />
                    </div>
                )}
                {isRetryFormOpen && (
                    <div className="rounded-3xl bg-card p-6 shadow-lg shadow-black/5 -mt-8 pt-8">
                        <JobRetryForm
                            jobId={job.id}
                            currentComments={comments}
                            onSuccess={handleRetrySuccess}
                            onCancel={handleRetryCancel}
                        />
                    </div>
                )}
            </div>

         

            <div className="grid gap-6 xl:grid-cols-3">
                <div className="space-y-6 xl:col-span-2">
                    {job.updates && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Updates</CardTitle>
                            </CardHeader>
                            <CardContent className="max-h-[400px] overflow-y-auto">
                                <JobsUpdateSection updates={job.updates} />
                            </CardContent>
                        </Card>
                    )}
                    <JobDescription job={job} />

                    <JobComments comments={comments} />

                    
                </div>

                <div className="space-y-6">
                    <JobMetadata metadataItems={metadataItems} />
                    <JobPullRequest prLink={job.pr_link} confidenceScore={job.confidence_score} />
                </div>

                   
            </div>
                    {/* Execution Logs - Full Width */}
                    <Card className='mb-4 w-full'>
                            <CardHeader>
                                <CardTitle>Execution Logs</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
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
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    const logsContent = Array.isArray(job.code_generation_logs)
                                                        ? job.code_generation_logs.map(log =>
                                                            typeof log === 'string' ? log : JSON.stringify(log, null, 2)
                                                        ).join('\n')
                                                        : formatLogs(job.code_generation_logs)
                                                    navigator.clipboard.writeText(logsContent || '')
                                                    toast({
                                                        title: 'Copied to clipboard',
                                                        description: 'Code Generation Logs have been copied.',
                                                    })
                                                }}
                                                disabled={!job.code_generation_logs || (Array.isArray(job.code_generation_logs) && job.code_generation_logs.length === 0)}
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
        </div>
    )
}

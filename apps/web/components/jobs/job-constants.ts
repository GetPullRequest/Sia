import type { JobResponse } from '@/types'

export const statusColors: Record<string, string> = {
    queued: 'bg-status-queued',
    'in-progress': 'bg-status-running',
    'in-review': 'bg-status-idle',
    completed: 'bg-status-completed',
    failed: 'bg-status-failed'
}

export const acceptanceStyles: Record<
    NonNullable<JobResponse['user_acceptance_status']>,
    string
> = {
    not_reviewed: 'border border-slate-200 bg-slate-50 text-slate-700',
    reviewed_and_accepted: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
    reviewed_and_asked_rework: 'border border-amber-200 bg-amber-50 text-amber-700',
    rejected: 'border border-rose-200 bg-rose-50 text-rose-700',
}

export const formatDateTime = (value: string | Date) => new Date(value).toLocaleString()

export const formatRelativeTime = (value: string | Date) => {
    const date = new Date(value)
    const diffMs = Date.now() - date.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)

    if (diffMinutes < 60) return `${diffMinutes}m ago`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return `${Math.floor(diffHours / 24)}d ago`
}


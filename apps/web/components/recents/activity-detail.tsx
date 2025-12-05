"use client"

import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import type { Activity } from '@sia/models'
import { cn } from '@/lib/utils'
import { GitBranch, Code, ShieldCheck, Copy, ChevronDown, PlayCircle, CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useToast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getActivityNameBadge } from './utils'

interface ActivityDetailProps {
  activity: Activity
}

const getActivityIcon = (name: string) => {
  const nameLower = name.toLowerCase()
  if (nameLower.includes('pr') || nameLower.includes('pull request')) {
    return <GitBranch className="h-5 w-5 text-purple-500" />
  }
  if (nameLower.includes('execution') || nameLower.includes('started')) {
    return <PlayCircle className="h-5 w-5 text-blue-500" />
  }
  if (nameLower.includes('completed')) {
    return <CheckCircle2 className="h-5 w-5 text-green-500" />
  }
  if (nameLower.includes('failed')) {
    return <XCircle className="h-5 w-5 text-red-500" />
  }
  return null
}

const formatTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

const formatDateTime = (value: string | Date) => {
  const date = new Date(value)
  return date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

const getActivityIdShort = (id: string) => {
  // Extract the first part before the dash or use the full id
  const parts = id.split('-')
  return parts.length > 0 ? parts[0] : id
}

export function ActivityDetail({ activity }: ActivityDetailProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [logsOpen, setLogsOpen] = useState({
    generation: true,
    verification: false,
  })

  // Mark activity as read when component mounts
  useEffect(() => {
    if (activity.read_status === 'unread') {
      api.updateActivityReadStatus(activity.id, 'read')
        .then(() => {
          // Invalidate activities query to refresh the list
          queryClient.invalidateQueries({ queryKey: ['activities'] })
          queryClient.invalidateQueries({ queryKey: ['activity', activity.id] })
        })
        .catch((error) => {
          console.error('Failed to mark activity as read:', error)
        })
    }
  }, [activity.id, activity.read_status, queryClient])

  const nameBadge = getActivityNameBadge(activity.name)
  const relativeTime = formatTime(activity.created_at)
  const activityIdShort = getActivityIdShort(activity.id)
  const activityIcon = getActivityIcon(activity.name)

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
  ] as const

  return (
    <div className="h-full bg-background flex flex-col">
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header Section */}
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">Activity Details</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
                {activity.job_id && (
                  <>
                    <Link
                      href={`/jobs/${activity.job_id}`}
                      className="hover:text-primary transition-colors underline decoration-muted-foreground/40 hover:decoration-primary"
                    >
                      {activity.job_id}
                    </Link>
                    <span className="text-muted-foreground/40">•</span>
                  </> 
                )}
                <span>{relativeTime}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activityIcon}
              <div
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium',
                  nameBadge.badge
                )}
              >
                {nameBadge.label}
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Summary Card */}
              {activity.summary && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      {activity.summary}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Activity Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-muted/60 text-muted-foreground/80">
                        AI
                      </span>
                      <span className="text-sm text-foreground/90">
                        {activity.name}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90">{activity.name}</p>
                    <p className="text-xs text-muted-foreground/70">{relativeTime}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Activity Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Activity Metadata</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  <MetadataRow label="Activity ID" value={`evt-${activityIdShort}`} />
                  <MetadataRow label="Type" value={activity.name} />
                  <MetadataRow
                    label="Job ID"
                    value={
                      activity.job_id ? (
                        <Link
                          href={`/jobs/${activity.job_id}`}
                          className="hover:text-primary transition-colors underline decoration-muted-foreground/40 hover:decoration-primary"
                        >
                          {activity.job_id}
                        </Link>
                      ) : (
                        '—'
                      )
                    }
                  />
                  <MetadataRow label="Updated by" value={activity.updated_by} />
                  <MetadataRow label="Created" value={formatDateTime(activity.created_at)} />
                  <MetadataRow label="Relative Time" value={relativeTime} />
                </dl>
              </CardContent>
            </Card>
          </div>

          {/* Logs Sections */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Execution Logs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {logSections.map((section) => (
                <Collapsible
                  key={section.key}
                  open={logsOpen[section.key]}
                  onOpenChange={(isOpen) =>
                    setLogsOpen((prev) => ({ ...prev, [section.key]: isOpen }))
                  }
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between rounded-lg border border-border/70  px-4 py-3">
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
    </div>
  )
}

function MetadataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground/70">{label}</dt>
      <dd className="font-medium text-foreground/90">{value}</dd>
    </div>
  )
}


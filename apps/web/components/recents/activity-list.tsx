"use client"

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Activity } from '@sia/models'
import {
  CheckCircle2,
  PlayCircle,
  GitBranch,
  XCircle,
  Filter,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { getActivityNameBadge } from './utils'

interface ActivityListProps {
  activities: Activity[]
  selectedActivityId: string | null
  onSelectActivity: (id: string) => void
}

const getActivityIcon = (name: string) => {
  const nameLower = name.toLowerCase()
  if (nameLower.includes('pr') || nameLower.includes('pull request')) {
    return <GitBranch className="h-4 w-4 text-purple-500" />
  }
  if (nameLower.includes('execution') || nameLower.includes('started')) {
    return <PlayCircle className="h-4 w-4 text-blue-500" />
  }
  if (nameLower.includes('completed')) {
    return <CheckCircle2 className="h-4 w-4 text-green-500" />
  }
  if (nameLower.includes('failed')) {
    return <XCircle className="h-4 w-4 text-red-500" />
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

export function ActivityList({
  activities,
  selectedActivityId,
  onSelectActivity,
}: ActivityListProps) {
  const [filter, setFilter] = useState<'all' | 'read' | 'unread'>('all')

  const handleSelectActivity = (id: string) => {
    onSelectActivity(id)
  }

  const filteredActivities = activities.filter((activity) => {
    if (filter === 'read') {
      return activity.read_status === 'read'
    }
    if (filter === 'unread') {
      return activity.read_status === 'unread'
    }
    return true
  })

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Agents Activity</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {filteredActivities.length} activities
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Filter className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={filter}
                  onValueChange={(value) => setFilter(value as 'all' | 'read' | 'unread')}
                >
                  <DropdownMenuRadioItem value="all">
                    Show All
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="read">
                    Read
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="unread">
                    Unread
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="divide-y divide-border">
          {filteredActivities.map((activity) => {
            const isSelected = activity.id === selectedActivityId
            const isUnread = activity.read_status === 'unread'
            const nameBadge = getActivityNameBadge(activity.name)

            return (
              <div
                key={activity.id}
                onClick={() => handleSelectActivity(activity.id)}
                className={cn(
                  'cursor-pointer transition-colors hover:bg-sidebar-selected/50 p-4 rounded-xl',
                  isSelected && 'bg-sidebar-selected',
                  !isUnread && 'opacity-60'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-1.5">
                    {isUnread && (
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className={cn(
                        "text-base font-medium line-clamp-2 transition-colors",
                        !isUnread ? "text-muted-foreground/60" : "text-foreground"
                      )}>
                        {activity.name}
                      </p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getActivityIcon(activity.name)}
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', nameBadge.badge)}>
                          {nameBadge.label}
                        </span>
                      </div>
                    </div>
                    <div className={cn(
                      "flex items-center gap-2 text-xs transition-colors",
                      !isUnread ? "text-muted-foreground/50" : "text-muted-foreground"
                    )}>
                      <span>{formatTime(activity.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {filteredActivities.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No recent activity
          </div>
        )}
      </div>
    </div>
  )
}


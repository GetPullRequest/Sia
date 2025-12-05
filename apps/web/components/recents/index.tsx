"use client"

import { useState, useEffect } from 'react'
import { useActivities } from '@/hooks/use-activities'
import { ActivityList } from './activity-list'
import { ActivityDetail } from './activity-detail'

export default function RecentsPage() {
  const {
    data: activities = [],
    isLoading,
    isError,
  } = useActivities()

  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)

  // Auto-select the first activity when activities load
  useEffect(() => {
    if (activities.length > 0 && !selectedActivityId) {
      setSelectedActivityId(activities[0].id)
    }
  }, [activities, selectedActivityId])

  const selectedActivity = activities.find((a) => a.id === selectedActivityId) || null

  if (isLoading && activities.length === 0) {
    return (
      <div className="flex h-[calc(100vh-8rem)] w-full -m-6">
        <div className="flex items-center justify-center w-full text-muted-foreground/60 text-sm">
          Loading...
        </div>
      </div>
    )
  }

  if (isError && activities.length === 0) {
    return (
      <div className="flex h-[calc(100vh-8rem)] w-full -m-6">
        <div className="flex items-center justify-center w-full text-muted-foreground/60 text-sm">
          Failed to load activities
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full bg-background">
      {/* Activity List */}
      <div className="w-[380px] border-r border-border/40 flex flex-col bg-background">
        <ActivityList
          activities={activities}
          selectedActivityId={selectedActivityId}
          onSelectActivity={setSelectedActivityId}
        />
      </div>
      {/* Activity Detail */}
      <div className="flex-1 bg-background">
        {selectedActivity ? (
          <ActivityDetail activity={selectedActivity} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground/50 text-sm">
            Select an activity to view details
          </div>
        )}
      </div>
    </div>
  )
}


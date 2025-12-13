'use client';

import { useState, useEffect } from 'react';
import { useActivities } from '@/hooks/use-activities';
import { ActivityList } from './activity-list';
import { ActivityDetail } from './activity-detail';

export default function RecentsPage() {
  const { data: activities = [], isLoading, isError } = useActivities();

  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    null
  );

  // Auto-select the first activity when activities load
  useEffect(() => {
    if (activities.length > 0 && !selectedActivityId) {
      setSelectedActivityId(activities[0].id);
    }
  }, [activities, selectedActivityId]);

  const selectedActivity =
    activities.find(a => a.id === selectedActivityId) || null;

  if (isLoading && activities.length === 0) {
    return (
      <div className="flex h-[calc(100vh-8rem)] w-full -m-6">
        <div className="flex items-center justify-center w-full text-muted-foreground/60 text-xs">
          Loading...
        </div>
      </div>
    );
  }

  if (isError && activities.length === 0) {
    return (
      <div className="flex h-[calc(100vh-8rem)] w-full -m-6">
        <div className="flex items-center justify-center w-full text-muted-foreground/60 text-xs">
          Failed to load activities
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-background">
      {/* Activity List */}
      <div className="w-[360px] min-w-[320px] border border-border flex flex-col bg-card rounded-lg">
        <ActivityList
          activities={activities}
          selectedActivityId={selectedActivityId}
          onSelectActivity={setSelectedActivityId}
        />
      </div>
      {/* Activity Detail */}
      <div className="flex-1 bg-background">
        {selectedActivity ? (
          <ActivityDetail
            activity={selectedActivity}
            onDelete={() => {
              // Find the next activity to select, or clear selection
              const currentIndex = activities.findIndex(
                a => a.id === selectedActivityId
              );
              if (currentIndex !== -1) {
                // Try to select the next activity, or previous if at the end
                const nextActivity =
                  activities[currentIndex + 1] || activities[currentIndex - 1];
                setSelectedActivityId(nextActivity?.id || null);
              } else {
                setSelectedActivityId(null);
              }
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground/50 text-xs">
            Select an activity to view details
          </div>
        )}
      </div>
    </div>
  );
}

"use client"

import type { JobResponse } from '@/types'
import type { Agent } from '@/types'
import { JobCard } from '@/components/home/job-card'
import type { LaneDefinition } from './type'
import { LaneColumn } from './lane-column'

type LaneListProps = {
  laneDefinitions: LaneDefinition[]
  jobsByLane: Record<string, JobResponse[]> & { rework: JobResponse[]; backlog: JobResponse[] }
  showRework: boolean
  onStartJob?: (id: string) => void
  onCancelJob?: (id: string) => void
  onSelectReviewJob?: (job: JobResponse) => void
  activeAgent: Agent | null
  theme?: string
}

export function LaneList({
  laneDefinitions,
  jobsByLane,
  showRework,
  onStartJob,
  onCancelJob,
  onSelectReviewJob,
  activeAgent,
  theme,
}: LaneListProps) {
  return (
    <div className="flex gap-4 h-full max-w-[300px] min-w-[200px] ">
      {laneDefinitions.map((lane) => {
        const handleExecuteRework =
          lane.id === 'queue' && onStartJob
            ? () => {
              const firstReworkJob = jobsByLane.rework[0]
              if (firstReworkJob) {
                onStartJob(firstReworkJob.id)
              }
            }
            : undefined

        const handleExecuteBacklog =
          lane.id === 'queue' && onStartJob
            ? () => {
              const firstBacklogJob = jobsByLane.backlog[0]
              if (firstBacklogJob) {
                onStartJob(firstBacklogJob.id)
              }
            }
            : undefined

        return (
          <LaneColumn
            key={lane.id}
            lane={lane}
            jobs={jobsByLane[lane.id] ?? []}
            reworkJobs={lane.id === 'queue' ? jobsByLane.rework : undefined}
            backlogJobs={lane.id === 'queue' ? jobsByLane.backlog : undefined}
            onExecuteRework={handleExecuteRework}
            onExecuteBacklog={handleExecuteBacklog}
            showRework={showRework}
            activeAgent={lane.id === 'in-progress' ? activeAgent : undefined}
            theme={theme}
            renderJob={(job, helpers) => (
              <JobCard
                key={job.id}
                job={job}
                onStart={lane.id === 'queue' ? undefined : lane.id === 'in-progress' ? onStartJob : onStartJob}
                onCancel={lane.id === 'queue' ? undefined : lane.id === 'in-progress' ? onCancelJob : undefined}
                hideActions={lane.id === 'queue'}
                isDraggable={lane.id === 'queue'}
                isClickable
                onDisableLaneAnimation={helpers?.disableAnimatedBorder}
                onEnableLaneAnimation={helpers?.enableAnimatedBorder}
                isAnimationDisabled={helpers?.isAnimationDisabled}
                onCardClick={lane.id === 'completed' ? onSelectReviewJob : undefined}
              />
            )}
          />
        )
      })}
    </div>
  )
}


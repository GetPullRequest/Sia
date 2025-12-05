"use client"

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CircleDashed, Pause, PlayCircle } from 'lucide-react'
import type { JobResponse } from '@/types'
import type { Agent } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import type { LaneDefinition } from './type'

type LaneRenderHelpers = {
  disableAnimatedBorder: () => void
  enableAnimatedBorder: () => void
  isAnimationDisabled: boolean
}

const QUEUE_TOOLTIP_MESSAGE = 'Waiting to process next item in queue'
const IN_PROGRESS_TOOLTIP_MESSAGE = 'Agent is currently processing the task'

// Placeholder card component (Trello-style vacant space)
const PlaceholderCard = () => (
  <div className="rounded-lg border-2 border-dashed border-primary/60 bg-primary/10 backdrop-blur-sm min-h-[140px] w-full flex items-center justify-center shadow-sm animate-in fade-in-0 duration-150">
    <div className="flex flex-col items-center gap-2 opacity-60">
      <div className="h-1.5 w-20 rounded-full bg-primary/50" />
      <div className="h-1 w-14 rounded-full bg-primary/40" />
    </div>
  </div>
)

export type LaneColumnProps = {
  lane: LaneDefinition
  jobs: JobResponse[]
  renderJob: (job: JobResponse, helpers?: LaneRenderHelpers) => ReactNode
  footer?: ReactNode
  reworkJobs?: JobResponse[]
  backlogJobs?: JobResponse[]
  onExecute?: () => void
  onExecuteRework?: () => void
  onExecuteBacklog?: () => void
  showRework?: boolean
  activeAgent?: Agent | null
  theme?: string | undefined
  reworkQueuePaused?: boolean
  backlogQueuePaused?: boolean
  onToggleReworkQueue?: () => void
  onToggleBacklogQueue?: () => void
  dropIndicator?: { containerId: string; index: number } | null
  activeJobId?: string | null
}

export function LaneColumn({
  lane,
  jobs,
  renderJob,
  footer,
  reworkJobs,
  backlogJobs,
  onExecute,
  onExecuteRework,
  onExecuteBacklog,
  showRework = true,
  activeAgent,
  theme,
  reworkQueuePaused,
  backlogQueuePaused,
  onToggleReworkQueue,
  onToggleBacklogQueue,
  dropIndicator,
  activeJobId,
}: LaneColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `lane-${lane.id}`,
    data: { type: 'lane', status: lane.id },
  })

  const isQueueLane = lane.id === 'queue'
  const isInProgressLane = lane.id === 'in-progress'
  const queueReworkJobs = reworkJobs ?? []
  const queueBacklogJobs = backlogJobs ?? []
  const [isAnimationDisabled, setIsAnimationDisabled] = useState(false)
  const hasActiveInProgressJob = jobs.some((job) => job.status === 'in-progress')
  const shouldShowAnimatedBorder = isInProgressLane && hasActiveInProgressJob && !isAnimationDisabled
  const disableAnimatedBorder = useCallback(() => {
    setIsAnimationDisabled(true)
  }, [])
  const enableAnimatedBorder = useCallback(() => {
    setIsAnimationDisabled(false)
  }, [])
  const laneRenderHelpers = isInProgressLane ? { disableAnimatedBorder, enableAnimatedBorder, isAnimationDisabled } : undefined
  const inProgressBorderStyle: CSSProperties = {
    padding: '2px',
    borderRadius: '1.125rem',
    background:
      'conic-gradient(from var(--lane-spin-angle, 0deg), hsl(var(--primary) / 0) 0deg, hsl(var(--primary) / 0.25) 110deg, hsl(var(--primary)) 180deg, hsl(var(--primary) / 0.25) 250deg, hsl(var(--primary) / 0) 360deg)',
    animation: 'lane-spin 3s linear infinite',
    WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
    WebkitMaskComposite: 'xor',
    maskComposite: 'exclude',
  }

  useEffect(() => {
    if (isInProgressLane && !hasActiveInProgressJob) {
      setIsAnimationDisabled(false)
    }
  }, [isInProgressLane, hasActiveInProgressJob])

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'h-[78vh] max-w-[350px] min-w-[300px] flex-shrink-0 rounded-2xl overflow-y-auto border bg-card-lane p-4 overflow-hidden backdrop-blur transition-shadow flex flex-col',
        isInProgressLane && 'shadow-primary/20 shadow-lg relative',
        shouldShowAnimatedBorder ? 'border-transparent ' : 'border-border/50',
        isOver && 'ring-2 ring-primary/30 shadow-lg shadow-primary/10'
      )}
    >
      {shouldShowAnimatedBorder && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -m-px block rounded-[1.125rem]"
          style={inProgressBorderStyle}
        />
      )}
      <div className="mb-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h3 className="text-lg font-semibold">{lane.title}</h3>
        </div>
        <Badge variant="secondary">{jobs.length}</Badge>
      </div>
      <div className="space-y-3 min-h-[64px] flex-1 overflow-y-auto overflow-x-hidden pr-1">
        {isInProgressLane && activeAgent && !isAnimationDisabled && (
          <div className="space-y-4 pb-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Active Agent –{' '}
                  <Link
                    href="/agents"
                    className="text-foreground hover:text-primary transition-colors underline decoration-muted-foreground/40 hover:decoration-primary"
                  >
                    {activeAgent.name}
                  </Link>
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="h-8 w-8 flex items-center justify-center">
                      {hasActiveInProgressJob ? (
                        <Spinner
                          className={cn(
                            theme === 'dark' ? 'text-white' : 'text-black'
                          )}
                          size="icon"
                        />
                      ) : (
                        <CircleDashed
                          className={cn(
                            'h-5 w-5',
                            theme === 'dark' ? 'text-white' : 'text-black'
                          )}
                          strokeWidth={1.5}
                        />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="end">
                    {hasActiveInProgressJob
                      ? IN_PROGRESS_TOOLTIP_MESSAGE
                      : 'No tasks are currently running'}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        )}
        {isQueueLane ? (
          <>
            {showRework && (
              <Card className="space-y-3 p-2 bg-card-sublane">
                <div className="mb-2 flex items-center justify-between px-2">
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rework</p>
                    <Badge variant="outline">{queueReworkJobs.length}</Badge>
                  </div>
                  <div className="flex items-center gap-0">
                    {onToggleReworkQueue && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onToggleReworkQueue()}
                            aria-label={reworkQueuePaused ? 'Resume Processing Queue' : 'Pause Rework Queue'}
                          >
                            {reworkQueuePaused ? (
                              <PlayCircle className="h-5 w-5" strokeWidth={1.5} />
                            ) : (
                              <Pause className="h-4 w-4" strokeWidth={1.5} />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left" align="center">
                          {reworkQueuePaused ? 'Resume Processing Queue' : 'Pause Rework Queue'}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {onExecuteRework && !reworkQueuePaused && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={onExecuteRework}
                            disabled={queueReworkJobs.length === 0}
                            className="h-6 px-2 text-xs"
                            size="sm"
                            variant="ghost"
                          >
                            <div
                              className={cn(
                                'h-5 w-5 [&_canvas]:drop-shadow-[0_0_1px_currentColor,0_0_1px_currentColor,0_0_1px_currentColor] [&_canvas]:filter',
                                theme === 'dark' ? 'brightness-0 invert' : 'brightness-0'
                              )}
                            >
                              <DotLottieReact
                                key={`rework-waiting-${theme}`}
                                src="/waiting.lottie"
                                loop
                                autoplay
                                speed={0.5}
                                className="h-full w-full"
                              />
                            </div>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left" align="center" className="max-w-52 text-wrap text-center z-[1000]">
                          {QUEUE_TOOLTIP_MESSAGE}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
                {queueReworkJobs.length > 0 ? (
                  <SortableContext
                    id={`${lane.id}-rework`}
                    items={queueReworkJobs.map((job) => job.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {queueReworkJobs.map((job, index) => {
                        return (
                          <div key={job.id}>
                            {/* {shouldShowPlaceholder && <PlaceholderCard />} */}
                            <Card className="bg-card-sublane rounded-lg">
                              {renderJob(job, laneRenderHelpers)}
                            </Card>
                          </div>
                        )
                      })}
                      {/* Show placeholder at the end */}
                      {dropIndicator?.containerId === `${lane.id}-rework` &&
                        dropIndicator.index === queueReworkJobs.filter((job) => job.id !== activeJobId).length &&
                        <PlaceholderCard />}
                    </div>
                  </SortableContext>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="pt-6 text-center text-sm text-muted-foreground">
                      No jobs awaiting rework
                    </CardContent>
                  </Card>
                )}
              </Card>
            )}
            <Card className={showRework ? 'space-y-3 pt-4 bg-card-sublane ' : 'space-y-3 pt-2 bg-card-sublane'}>
              <div className="mb-2 flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Backlog</p>
                  <Badge variant="outline">{queueBacklogJobs.length}</Badge>
                </div>
                <div className="flex items-center gap-0">
                  {onToggleBacklogQueue && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onToggleBacklogQueue()}
                          aria-label={backlogQueuePaused ? 'Resume Processing Queue' : 'Pause Backlog Queue'}
                        >
                          {backlogQueuePaused ? (
                            <PlayCircle className="h-5 w-5" strokeWidth={1.5} />
                          ) : (
                            <Pause className="h-4 w-4" strokeWidth={1.5} />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" align="center">
                        {backlogQueuePaused ? 'Resume Processing Queue' : 'Pause Backlog Queue'}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {onExecuteBacklog && !backlogQueuePaused && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={onExecuteBacklog}
                          disabled={queueBacklogJobs.length === 0}
                          className="h-6 px-2 text-xs"
                          size="sm"
                          variant="ghost"
                        >
                          <div
                            className={cn(
                              'h-4 w-4 [&_canvas]:drop-shadow-[0_0_1px_currentColor,0_0_1px_currentColor,0_0_1px_currentColor] [&_canvas]:filter',
                              theme === 'dark' ? 'brightness-0 invert' : 'brightness-0'
                            )}
                          >
                            <DotLottieReact
                              key={`backlog-waiting-${theme}`}
                              src="/waiting.lottie"
                              loop
                              autoplay
                              speed={0.5}
                              className="h-full w-full"
                            />
                          </div>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" align="center" className="max-w-56 text-wrap text-center z-[1000]">
                        {QUEUE_TOOLTIP_MESSAGE}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
              {queueBacklogJobs.length > 0 ? (
                <SortableContext
                  id={`${lane.id}-backlog`}
                  items={queueBacklogJobs.map((job) => job.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3 p-2">
                    {queueBacklogJobs.map((job, index) => {
                      
                      return (
                        <div key={job.id}>
                          {/* {shouldShowPlaceholder && <PlaceholderCard />} */}
                          <Card className="bg-card-sublane rounded-lg">
                            {renderJob(job, laneRenderHelpers)}
                          </Card>
                        </div>
                      )
                    })}
                    {/* Show placeholder at the end */}
                    {/* {dropIndicator?.containerId === `${lane.id}-backlog` &&
                      dropIndicator.index === queueBacklogJobs.filter((job) => job.id !== activeJobId).length &&
                      <PlaceholderCard />} */}
                  </div>
                </SortableContext>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="pt-6 text-center text-sm text-muted-foreground">{lane.emptyState}</CardContent>
                </Card>
              )}
            </Card>
          </>
        ) : (
          <>
            {jobs.map((job) => renderJob(job, laneRenderHelpers))}
            {jobs.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="pt-6 text-center text-sm text-muted-foreground">{lane.emptyState}</CardContent>
              </Card>
            )}
          </>
        )}
      </div>
      {footer && <div className="mt-6 flex-shrink-0">{footer}</div>}
    </div>
  )
}


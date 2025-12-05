'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { useJobLogsWebSocket } from '@/hooks/use-job-logs-websocket'
import { api } from '@/lib/api'

interface LogEntry {
  id: string
  level: string
  message: string
  timestamp: string
  stage?: string
}

interface StreamingLogsViewerProps {
  jobId: string
  jobVersion?: number | null
  enabled?: boolean
  className?: string
  height?: string
  initialLogs?: Array<{
    level: string
    timestamp: string
    message: string
    stage?: string
  }>
  useWebSocket?: boolean // If false, uses REST API instead
}

function getSeverityIcon(level: string) {
  const normalizedLevel = level.toLowerCase()
  if (normalizedLevel === 'error') {
    return '🔴'
  }
  if (normalizedLevel === 'warn') {
    return '🟡'
  }
  if (normalizedLevel === 'info') {
    return 'ℹ️'
  }
  return '*'
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    // Use system timezone - toLocaleString automatically uses the user's timezone
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
      hour12: false,
      timeZoneName: 'short', // This will add timezone abbreviation (e.g., PST, EST, IST)
    })
  } catch {
    return timestamp
  }
}

export function StreamingLogsViewer({
  jobId,
  jobVersion,
  enabled = true,
  className,
  height = '600px',
  initialLogs = [],
  useWebSocket = true,
}: StreamingLogsViewerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)
  const logIdCounterRef = useRef(0)
  const previousLogsLengthRef = useRef(0)
  const initialLogsLoadedRef = useRef(false)
  const logsFetchedRef = useRef(false)

  const { logs: streamedLogs, isConnected } = useJobLogsWebSocket({
    jobId: enabled && useWebSocket ? jobId : null,
    jobVersion: enabled && useWebSocket ? jobVersion : null,
    enabled: enabled && useWebSocket,
    onLog: (log) => {
      setIsLoading(false)
      const newLog: LogEntry = {
        id: `log-${logIdCounterRef.current++}-${Date.now()}`,
        level: log.level,
        message: log.message,
        timestamp: log.timestamp,
        stage: log.stage,
      }
      setLogs((prev) => [newLog, ...prev])
    },
  })

  // Fetch logs via REST API when not using WebSocket
  useEffect(() => {
    if (!enabled || useWebSocket || logsFetchedRef.current) {
      return
    }

    // Show initialLogs immediately if available (for quick display)
    if (initialLogs.length > 0 && logs.length === 0) {
      const formattedLogs: LogEntry[] = initialLogs
        .map((log) => ({
          id: `log-${logIdCounterRef.current++}-${log.timestamp}`,
          level: log.level,
          message: log.message,
          timestamp: log.timestamp,
          stage: log.stage,
        }))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setLogs(formattedLogs)
      setIsLoading(false)
    }

    const fetchLogs = async () => {
      try {
        // Only show loading if we don't have initialLogs
        if (initialLogs.length === 0) {
          setIsLoading(true)
        }
        const fetchedLogs = await api.getJobLogs(jobId, jobVersion || undefined)
        logsFetchedRef.current = true
        
        if (fetchedLogs.length > 0) {
          const formattedLogs: LogEntry[] = fetchedLogs
            .map((log) => ({
              id: `log-${logIdCounterRef.current++}-${log.timestamp}`,
              level: log.level,
              message: log.message,
              timestamp: log.timestamp,
              stage: log.stage,
            }))
            // Sort by timestamp (newest first)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          setLogs(formattedLogs)
        }
        setIsLoading(false)
      } catch (error) {
        console.error('Failed to fetch logs:', error)
        setIsLoading(false)
        // Keep initialLogs if REST API fails
      }
    }

    fetchLogs()
  }, [enabled, useWebSocket, jobId, jobVersion, initialLogs, logs.length])

  // Check scroll position - user is at top if scrollTop <= 10px
  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const scrollTop = container.scrollTop
    const threshold = 10
    const isAtTop = scrollTop <= threshold

    setAutoScroll(isAtTop)
  }, [])

  // Handle scroll events
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      checkScrollPosition()
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [checkScrollPosition])

  // Auto-scroll to top when new logs arrive (only if auto-scroll is enabled)
  useEffect(() => {
    if (!autoScroll || logs.length === 0) {
      previousLogsLengthRef.current = logs.length
      return
    }

    const container = scrollContainerRef.current
    if (!container) {
      previousLogsLengthRef.current = logs.length
      return
    }

    // Only auto-scroll if new logs were added
    if (logs.length > previousLogsLengthRef.current) {
      requestAnimationFrame(() => {
        if (container && autoScroll) {
          container.scrollTop = 0
        }
      })
    }

    previousLogsLengthRef.current = logs.length
  }, [logs, autoScroll])

  // Load initial logs from job prop when component mounts (only for WebSocket mode or as fallback)
  useEffect(() => {
    if (!initialLogsLoadedRef.current && initialLogs.length > 0) {
      // For WebSocket mode, use initialLogs as a starting point
      // For REST mode, we'll fetch via API, but initialLogs can be a fallback
      if (useWebSocket || (!useWebSocket && logs.length === 0)) {
        setIsLoading(false)
        const formattedLogs: LogEntry[] = initialLogs
          .map((log) => ({
            id: `log-${logIdCounterRef.current++}-${log.timestamp}`,
            level: log.level,
            message: log.message,
            timestamp: log.timestamp,
            stage: log.stage,
          }))
          // Sort by timestamp (newest first)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        setLogs(formattedLogs)
        initialLogsLoadedRef.current = true
        
        // Auto-scroll to top after initial load
        setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0
            setAutoScroll(true)
          }
        }, 100)
      }
    }
  }, [initialLogs, useWebSocket, logs.length])

  // Merge streamed logs (from WebSocket historical-logs) with existing logs
  useEffect(() => {
    if (streamedLogs.length > 0) {
      setIsLoading(false)
      // Merge streamed logs with existing logs, avoiding duplicates
      setLogs((prev) => {
        const existingKeys = new Set(prev.map(log => `${log.timestamp}-${log.message}`));
        const newLogs = streamedLogs
          .filter(log => !existingKeys.has(`${log.timestamp}-${log.message}`))
          .map((log) => ({
            id: `log-${logIdCounterRef.current++}-${log.timestamp}`,
            level: log.level,
            message: log.message,
            timestamp: log.timestamp,
            stage: log.stage,
          }));
        
        // Combine and sort by timestamp (newest first)
        const combined = [...prev, ...newLogs];
        combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return combined;
      });
    }
  }, [streamedLogs])

  // Reset when job changes or when disabled
  useEffect(() => {
    if (!enabled) {
      setLogs([])
      setIsLoading(true)
      setAutoScroll(true)
      logIdCounterRef.current = 0
      previousLogsLengthRef.current = 0
      initialLogsLoadedRef.current = false
      logsFetchedRef.current = false
      
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0
      }
    } else {
      // Reset when jobId changes
      setLogs([])
      setIsLoading(true)
      logIdCounterRef.current = 0
      previousLogsLengthRef.current = 0
      initialLogsLoadedRef.current = false
      logsFetchedRef.current = false
    }
  }, [enabled, jobId])

  if (!enabled) {
    return null
  }

  return (
    <div 
      className={cn('flex flex-col border rounded-lg bg-background overflow-hidden', className)} 
      style={{ height }}
    >
      {isLoading && useWebSocket && isConnected && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground border-b bg-background">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading more logs...</span>
        </div>
      )}
      
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto"
      >
        {logs.length === 0 && !isLoading && (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            No logs available yet.
          </div>
        )}

        <div className="min-w-full">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-background z-10 border-b">
              <tr>
                <th className="text-left p-2 text-xs font-semibold text-muted-foreground w-12">
                  Severity
                </th>
                <th className="text-left p-2 text-xs font-semibold text-muted-foreground w-48">
                  Timestamp
                </th>
                <th className="text-left p-2 text-xs font-semibold text-muted-foreground">
                  Summary
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const normalizedLevel = log.level.toLowerCase()
                const isError = normalizedLevel === 'error' || normalizedLevel === 'err'
                const isWarning = normalizedLevel === 'warn' || normalizedLevel === 'warning'
                
                return (
                  <tr
                    key={log.id}
                    className={cn(
                      'border-b border-border/50 hover:bg-muted/30 transition-colors',
                      isError && 'bg-destructive/5',
                      isWarning && 'bg-yellow-500/5'
                    )}
                  >
                    <td className="p-2 text-xs">
                      <span>{getSeverityIcon(log.level)}</span>
                    </td>
                    <td className={cn(
                      'p-2 text-xs font-mono',
                      isError ? 'text-destructive' : isWarning ? 'text-yellow-600' : 'text-muted-foreground'
                    )}>
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="p-2 text-xs break-words">
                      <div className="flex items-start gap-2">
                        {log.stage && (
                          <span className={cn(
                            'font-medium shrink-0',
                            isError ? 'text-destructive' : isWarning ? 'text-yellow-600' : 'text-muted-foreground'
                          )}>
                            [{log.stage}]
                          </span>
                        )}
                        <span className={cn(
                          isError && 'text-destructive font-medium',
                          isWarning && 'text-yellow-600 font-medium',
                          !isError && !isWarning && 'text-foreground'
                        )}>
                          {log.message}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

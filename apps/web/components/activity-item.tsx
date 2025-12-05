"use client"

import { Clock } from "lucide-react"

interface ActivityItemProps {
  message: string
  time: string
}

export function ActivityItem({ message, time }: ActivityItemProps) {
  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-0">
      <div className="flex-1">
        <p className="text-sm text-foreground">{message}</p>
        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{time}</span>
        </div>
      </div>
    </div>
  )
}


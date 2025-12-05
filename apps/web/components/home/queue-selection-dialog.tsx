"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { JobResponse } from '@sia/models'

export type QueueSelectionDialogProps = {
  open: boolean
  pendingQueueMove: {
    job: JobResponse
    targetIndex: number
  } | null
  onSelect: (targetQueue: 'rework' | 'backlog') => void
  onClose: () => void
}

export function QueueSelectionDialog({ open, pendingQueueMove, onSelect, onClose }: QueueSelectionDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Queue</DialogTitle>
          <DialogDescription>Where would you like to move "{pendingQueueMove?.job.generated_name}"?</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          <Button onClick={() => onSelect('rework')} variant="outline" className="justify-start h-auto py-4">
            <div className="text-left">
              <div className="font-semibold">Move to Rework</div>
              <div className="text-sm text-muted-foreground">For jobs that need to be reworked</div>
            </div>
          </Button>
          <Button onClick={() => onSelect('backlog')} variant="outline" className="justify-start h-auto py-4">
            <div className="text-left">
              <div className="font-semibold">Move to Backlog</div>
              <div className="text-sm text-muted-foreground">For new or regular queued jobs</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}


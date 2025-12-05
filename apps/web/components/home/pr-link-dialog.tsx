"use client"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { JobResponse } from '@/types'
import type { LaneId } from './type'

export type PrLinkDialogProps = {
  open: boolean
  pendingJobMove: {
    job: JobResponse
    targetLane: LaneId
    targetIndex: number
  } | null
  prLink: string
  prLinkError: string
  onChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}

export function PrLinkDialog({ open, pendingJobMove, prLink, prLinkError, onChange, onSubmit, onCancel }: PrLinkDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onCancel()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {pendingJobMove?.targetLane === 'completed' ? 'Add GitHub PR Review Link' : 'Add GitHub Pull Request Link'}
          </DialogTitle>
          <DialogDescription>
            Please provide a valid GitHub PR link to move "{pendingJobMove?.job.generated_name}" to{' '}
            {pendingJobMove?.targetLane === 'completed' ? 'Completed' : 'In Review'}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="pr-link" className="text-sm font-medium">
              {pendingJobMove?.targetLane === 'completed' ? 'GitHub PR Review Link' : 'GitHub PR Link'}
            </label>
            <Input
              id="pr-link"
              type="url"
              placeholder="https://github.com/owner/repo/pull/123"
              value={prLink}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onSubmit()
                }
              }}
              className={cn(prLinkError && 'border-destructive')}
            />
            {prLinkError && <p className="text-sm text-destructive">{prLinkError}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!prLink.trim()}>
            Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import type { Activity } from '@sia/models';

export type DeleteActivityDialogProps = {
  open: boolean;
  activity: Activity | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteActivityDialog({
  open,
  activity,
  onConfirm,
  onCancel,
}: DeleteActivityDialogProps) {
  const activityName = activity?.name || 'this activity';
  const activitySummary =
    activity?.summary?.substring(0, 50) || 'this activity';

  return (
    <Dialog
      open={open}
      onOpenChange={isOpen => {
        if (!isOpen) {
          onCancel();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Activity
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{activityName}"? This action cannot
            be undone.
          </DialogDescription>
          {activity?.summary && (
            <div className="mt-2 text-sm text-muted-foreground">
              <p className="truncate text-wrap">"{activitySummary}..."</p>
            </div>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'active' | 'idle' | 'offline' | 'connected' | 'disconnected';
  label?: string;
}

const statusConfig = {
  active: {
    color: 'bg-status-active',
    label: 'Active',
  },
  idle: {
    color: 'bg-status-idle',
    label: 'Idle',
  },
  offline: {
    color: 'bg-status-offline',
    label: 'Offline',
  },
  connected: {
    color: 'bg-status-completed',
    label: 'Connected',
  },
  disconnected: {
    color: 'bg-status-offline',
    label: 'Not Connected',
  },
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <div className={cn('h-2 w-2 rounded-full', config.color)} />
      <span className="text-sm font-medium">{label || config.label}</span>
    </div>
  );
}

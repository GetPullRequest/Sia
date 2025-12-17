'use client';

import * as React from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
  label: string;
  value: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select options...',
  disabled = false,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleUnselect = (value: string, e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(selected.filter(item => item !== value));
  };

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(item => item !== value));
    } else {
      onChange([...selected, value]);
    }
    // Close the popover after selection, similar to Select behavior
    setOpen(false);
  };

  const selectedOptions = options.filter(option =>
    selected.includes(option.value)
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex w-full  min-h-10 max-h-20 items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            // selected.length > 0 ? 'min py-2 max-h-20' : 'h-10 max-h-20',
            className
          )}
        >
          <div className="flex flex-wrap gap-1 flex-1 min-w-0">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selectedOptions.map(option => (
                <Badge
                  key={option.value}
                  variant="secondary"
                  className="text-xs shrink-0"
                  onClick={e => e.stopPropagation()}
                >
                  {option.label}
                  <span
                    role="button"
                    tabIndex={0}
                    className="ml-1 max-w-96 max-h-20 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer inline-flex items-center justify-center"
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleUnselect(option.value, e as any);
                      }
                    }}
                    onMouseDown={e => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={e => handleUnselect(option.value, e)}
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </span>
                </Badge>
              ))
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-1 min-w-[200px]"
        align="start"
        side="bottom"
        onInteractOutside={e => {
          // Allow normal closing behavior - don't prevent closing when clicking outside
          // This overrides the base popover's behavior that prevents closing inside dialogs
        }}
      >
        <div className="max-h-[300px] overflow-y-scroll">
          {options.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              No options available
            </div>
          ) : (
            options.map(option => {
              const isSelected = selected.includes(option.value);
              return (
                <div
                  key={option.value}
                  className={cn(
                    'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                    isSelected && 'bg-accent'
                  )}
                  onClick={() => handleSelect(option.value)}
                >
                  <div className="flex h-4 w-4 items-center justify-center mr-2">
                    {isSelected && <Check className="h-4 w-4" />}
                  </div>
                  <span>{option.label}</span>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

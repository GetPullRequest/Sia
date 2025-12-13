'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-[9999] bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    onInteractOutside?: (event: Event) => void;
    overlayClassName?: string;
  }
>(
  (
    { className, children, onInteractOutside, overlayClassName, ...props },
    ref
  ) => {
    const handleInteractOutside = React.useCallback(
      (event: Event) => {
        // Check if the interaction is with a nested dialog
        const target = event.target as HTMLElement;
        const nestedDialog = target.closest('[role="dialog"]');

        // If clicking/interacting with a nested dialog, prevent closing
        if (nestedDialog && nestedDialog !== event.currentTarget) {
          event.preventDefault();
          return;
        }

        // Call custom handler if provided
        if (onInteractOutside) {
          onInteractOutside(event);
        }
      },
      [onInteractOutside]
    );

    // Check if className specifies a higher z-index (indicating nested dialog)
    const hasHigherZIndex =
      className?.includes('z-[') &&
      (className.includes('10000') || className.includes('10001'));
    const overlayZIndex = hasHigherZIndex ? 'z-[10000]' : 'z-[9999]';

    return (
      <DialogPortal>
        <DialogOverlay className={cn(overlayZIndex, overlayClassName)} />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            'fixed left-[50%] top-[50%] shadow-2xl z-[9999] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4  bg-background pt-4 pb-6 px-6 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[8%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[4%] sm:rounded-2xl',
            className
          )}
          onInteractOutside={handleInteractOutside}
          onEscapeKeyDown={event => {
            // Check if there's a nested dialog open
            const nestedDialogs = document.querySelectorAll('[role="dialog"]');
            // If there are multiple dialogs (nested), only close the topmost one
            if (nestedDialogs.length > 1) {
              const topmostDialog = Array.from(nestedDialogs).pop();
              if (topmostDialog === event.currentTarget) {
                // Allow closing only if this is the topmost dialog
                return;
              }
              // Prevent closing parent dialog if nested dialog is open
              event.preventDefault();
              return;
            }
          }}
          {...props}
        >
          {children}
          <DialogPrimitive.Close className="absolute right-6 top-4 border border-border rounded-full p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-6 w-6" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  }
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1 text-center sm:text-left',
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-base font-semibold leading-none tracking-tight h-12',
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-xs text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};

import * as React from 'react';

import { cn } from '@/lib/utils';

type InputProps = React.ComponentProps<'input'> & {
  /**
   * When true, renders a textarea instead of an input to allow multiline content.
   * Useful for fields that need to support wrapping text.
   */
  asTextarea?: boolean;
};

const Input = React.forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  InputProps
>(({ className, type, asTextarea = false, ...props }, ref) => {
  const Component = asTextarea ? 'textarea' : 'input';

  return (
    <Component
      // textarea doesn't support type, so only pass it for input
      {...(!asTextarea && type ? { type } : {})}
      className={cn(
        'flex z-[9999] w-full rounded-md border border-border bg-background py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        asTextarea ? 'h-auto resize-none' : 'h-12',
        className
      )}
      ref={ref as React.ForwardedRef<any>}
      {...(props as any)}
    />
  );
});
Input.displayName = 'Input';

export { Input };

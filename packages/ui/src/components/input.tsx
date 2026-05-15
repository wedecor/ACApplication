import * as React from 'react';

import { cn } from '../lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', invalid, leading, trailing, ...props }, ref) => {
    if (leading || trailing) {
      return (
        <div
          className={cn(
            'flex h-10 items-center rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
            invalid && 'border-destructive focus-within:ring-destructive',
            className,
          )}
        >
          {leading ? <span className="pl-3 text-muted-foreground">{leading}</span> : null}
          <input
            ref={ref}
            type={type}
            className="flex-1 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            {...props}
          />
          {trailing ? <span className="pr-3 text-muted-foreground">{trailing}</span> : null}
        </div>
      );
    }
    return (
      <input
        ref={ref}
        type={type}
        aria-invalid={invalid || undefined}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          invalid && 'border-destructive focus-visible:ring-destructive',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

import * as React from 'react';

import { cn } from '../lib/cn';

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md' | 'lg';
}

const SIZE = {
  sm: 'size-4 border-2',
  md: 'size-6 border-[3px]',
  lg: 'size-10 border-4',
} as const;

export function Spinner({ size = 'md', className, ...props }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block animate-spin rounded-full border-current border-r-transparent text-primary',
        SIZE[size],
        className,
      )}
      {...props}
    />
  );
}

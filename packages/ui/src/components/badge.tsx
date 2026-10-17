import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../lib/cn';

export const badgeVariants = cva(
  'inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-danger-50 text-danger-700 dark:bg-danger-500/15 dark:text-danger-500',
        outline: 'text-foreground',
        success: 'border-transparent bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500',
        warning: 'border-transparent bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-500',
        info: 'border-transparent bg-info-50 text-info-700 dark:bg-info-500/15 dark:text-info-500',
        muted: 'border-transparent bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

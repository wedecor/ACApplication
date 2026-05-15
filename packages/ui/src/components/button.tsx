import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../lib/cn';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-sm',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        accent: 'bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm',
        success: 'bg-success-500 text-white hover:bg-success-600 shadow-sm',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-md px-6 text-base',
        xl: 'h-14 rounded-lg px-8 text-base',
        icon: 'size-10',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, fullWidth, asChild = false, loading, children, ...props },
    ref,
  ) => {
    const classes = cn(buttonVariants({ variant, size, fullWidth, className }));

    // Slot/asChild flow: Radix `Slot` requires exactly ONE React element child.
    // We must never inject a loading spinner here because that would produce two
    // children and trip `React.Children.only`. Callers wrapping a Link should
    // surface their own pending state inside the wrapped element.
    if (asChild) {
      return (
        <Slot ref={ref} className={classes} aria-busy={loading} {...props}>
          {children as React.ReactElement}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={classes}
        disabled={loading ?? props.disabled}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <span
            aria-hidden
            className="inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
          />
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

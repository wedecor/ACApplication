import * as React from 'react';

import { cn } from '../lib/cn';

export interface NavbarProps extends React.HTMLAttributes<HTMLElement> {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

/**
 * Top app bar. Pass branding/breadcrumbs as `leading` and user menu as
 * `trailing`. Sticky by default; consumer can override.
 */
export function Navbar({ leading, trailing, className, children, ...props }: NavbarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6',
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-3">{leading}</div>
      <div className="flex-1">{children}</div>
      <div className="flex items-center gap-2">{trailing}</div>
    </header>
  );
}

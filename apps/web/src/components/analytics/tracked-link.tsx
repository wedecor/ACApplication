'use client';

import Link from 'next/link';
import * as React from 'react';

import { type EventName, track } from '@/lib/analytics';

type TrackProps = Parameters<typeof track>[1];

/**
 * next/link that fires an analytics event on click. Lets Server Components
 * attach tracking without passing a function across the server/client boundary.
 */
export const TrackedLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<typeof Link> & { event: EventName; eventProps?: TrackProps }
>(function TrackedLink({ event, eventProps, onClick, ...props }, ref) {
  return (
    <Link
      ref={ref}
      {...props}
      onClick={(e) => {
        track(event, eventProps);
        onClick?.(e);
      }}
    />
  );
});

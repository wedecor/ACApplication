'use client';

import type { Permission } from '@ac/types';
import { Badge, cn, Label } from '@ac/ui';
import * as React from 'react';

import { ApiClientError } from '@/lib/api/client';
import {
  humanize,
  type JobCardStatus,
  type WarrantyClaimStatus,
  type WorkshopStatus,
} from '@/lib/api/repair';
import { formatDate } from '@/lib/format';
import { hasPermission, readSessionClaims } from '@/lib/rbac/permissions';

type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info'
  | 'muted';

/** Human-readable message for an API error. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    const details = err.details as { message?: string } | undefined;
    return details?.message ?? err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}

/** UI-only permission check (the API stays authoritative). */
export function useCan(permission: Permission): boolean {
  const [can, setCan] = React.useState(false);
  React.useEffect(() => {
    setCan(hasPermission(permission, readSessionClaims().permissions));
  }, [permission]);
  return can;
}

const inputClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => <select ref={ref} className={cn(inputClass, className)} {...props} />);
NativeSelect.displayName = 'NativeSelect';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(inputClass, 'h-auto min-h-[80px]', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const JOB_CARD_VARIANT: Record<JobCardStatus, BadgeVariant> = {
  DRAFT: 'muted',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
};

export function JobCardStatusBadge({ status }: { status: JobCardStatus }) {
  return <Badge variant={JOB_CARD_VARIANT[status]}>{humanize(status)}</Badge>;
}

const CLAIM_VARIANT: Record<WarrantyClaimStatus, BadgeVariant> = {
  OPEN: 'warning',
  APPROVED: 'info',
  REJECTED: 'destructive',
  SUBMITTED_TO_OEM: 'secondary',
  SETTLED: 'success',
  CLOSED: 'muted',
};

export function ClaimStatusBadge({ status }: { status: WarrantyClaimStatus }) {
  return <Badge variant={CLAIM_VARIANT[status]}>{humanize(status)}</Badge>;
}

const WORKSHOP_VARIANT: Record<WorkshopStatus, BadgeVariant> = {
  PICKUP_SCHEDULED: 'muted',
  PICKED_UP: 'secondary',
  RECEIVED_AT_WORKSHOP: 'secondary',
  DIAGNOSING: 'info',
  AWAITING_APPROVAL: 'warning',
  REPAIRING: 'info',
  READY_FOR_DELIVERY: 'success',
  OUT_FOR_DELIVERY: 'success',
  DELIVERED: 'default',
  CANCELLED: 'destructive',
};

export function WorkshopStatusBadge({ status }: { status: WorkshopStatus }) {
  return <Badge variant={WORKSHOP_VARIANT[status]}>{humanize(status)}</Badge>;
}

/** "Active until 12 Jan 2027" / "Expired 3 Mar 2026" / "None". */
export function WarrantyPill({
  label,
  active,
  until,
}: {
  label: string;
  active: boolean;
  until: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {until ? (
        <Badge variant={active ? 'success' : 'muted'}>
          {active ? 'Active until' : 'Expired'} {formatDate(until)}
        </Badge>
      ) : (
        <Badge variant="outline">None</Badge>
      )}
    </div>
  );
}

/** Format a datetime-local input value as ISO. */
export function localToIso(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Convert a date input (yyyy-mm-dd) to ISO, or null when cleared. */
export function dateToIso(value: string): string | null {
  return value ? new Date(`${value}T00:00:00`).toISOString() : null;
}

/** ISO → yyyy-mm-dd for <input type="date">. */
export function isoToDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}

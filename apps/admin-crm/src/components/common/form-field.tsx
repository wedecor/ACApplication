'use client';

import { cn, Label } from '@ac/ui';
import * as React from 'react';

export function Field({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const autoId = React.useId();
  // Link the label (and hint/error text) to a single form control child.
  const child = React.Children.count(children) === 1 && React.isValidElement(children) ? children : null;
  const childProps = (child?.props ?? {}) as { id?: string; 'aria-describedby'?: string };
  const controlId = childProps.id ?? autoId;
  const describedBy = error ? `${controlId}-error` : hint ? `${controlId}-hint` : undefined;
  const control = child
    ? React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
        id: controlId,
        'aria-describedby': [childProps['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined,
        ...(error ? { 'aria-invalid': true } : {}),
      })
    : children;
  return (
    <div className={className}>
      <Label htmlFor={child ? controlId : undefined} className="mb-1 block text-sm">
        {label}
      </Label>
      {control}
      {hint && !error ? (
        <p id={`${controlId}-hint`} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${controlId}-error`} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function NativeSelect({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn('h-10 w-full rounded-md border bg-background px-3 text-sm', className)}
      {...props}
    />
  );
});

export const TextArea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn('w-full rounded-md border bg-background px-3 py-2 text-sm', className)}
      {...props}
    />
  );
});

export function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-3 sm:p-4">
      <p className="truncate text-sm text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-xl font-semibold tabular-nums sm:text-2xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

'use client';

import { Badge, Button, Card, Skeleton } from '@ac/ui';
import { Loader2, Sparkles, Zap } from 'lucide-react';

import { useAutoAssign } from '@/hooks/use-dispatch';
import { type UnassignedBooking } from '@/lib/api/dispatch';
import { formatWhen } from '@/lib/format';

interface UnassignedQueueProps {
  bookings: UnassignedBooking[];
  isLoading: boolean;
  selectedBookingId: string | null;
  onSelect: (id: string) => void;
}

const PRIORITY_BADGE: Partial<Record<UnassignedBooking['priority'], { variant: 'destructive' | 'warning'; label: string }>> = {
  EMERGENCY: { variant: 'destructive', label: 'Emergency' },
  PRIORITY: { variant: 'warning', label: 'Priority' },
};

export function UnassignedQueue({
  bookings,
  isLoading,
  selectedBookingId,
  onSelect,
}: UnassignedQueueProps) {
  const auto = useAutoAssign();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-2 p-8 text-center">
        <Sparkles className="size-6 text-success-600" aria-hidden />
        <p className="text-sm font-semibold">All clear</p>
        <p className="text-sm text-muted-foreground">Every booking has a technician assigned.</p>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {bookings.map((b) => {
        const active = b.id === selectedBookingId;
        const badge = PRIORITY_BADGE[b.priority];
        const assigning = auto.isPending && auto.variables === b.id;
        return (
          <li
            key={b.id}
            className={`flex items-center gap-2 rounded-lg border bg-card pr-3 transition-colors ${
              active ? 'border-primary ring-1 ring-primary' : 'hover:border-foreground/20'
            }`}
          >
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(b.id)}
              className="min-w-0 flex-1 rounded-lg p-3 text-left"
            >
              <span className="flex items-center gap-2">
                <span className="truncate font-medium">{b.customer.fullName}</span>
                {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : null}
              </span>
              <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                {formatWhen(b.scheduledAt)} · {b.city.name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{b.code}</span>
            </button>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={assigning}
              aria-label={`Auto-assign ${b.code}`}
              onClick={() => auto.mutate(b.id)}
            >
              {assigning ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Zap aria-hidden />
              )}
              Auto
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

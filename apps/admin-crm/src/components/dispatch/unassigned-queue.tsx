'use client';

import { format } from 'date-fns';
import { ArrowRight, Loader2, Sparkles } from 'lucide-react';

import { Badge, Button, Card, Skeleton } from '@ac/ui';

import { useAutoAssign } from '@/hooks/use-dispatch';

import { type UnassignedBooking } from '@/lib/api/dispatch';

interface UnassignedQueueProps {
  bookings: UnassignedBooking[];
  isLoading: boolean;
  selectedBookingId: string | null;
  onSelect(id: string): void;
}

const PRIORITY_BADGE: Record<UnassignedBooking['priority'], { variant: 'destructive' | 'default' | 'secondary'; label: string }> = {
  EMERGENCY: { variant: 'destructive', label: 'EMERGENCY' },
  PRIORITY: { variant: 'default', label: 'PRIORITY' },
  STANDARD: { variant: 'secondary', label: 'STANDARD' },
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
        <Sparkles className="h-6 w-6 text-emerald-500" />
        <p className="text-sm font-semibold">All clear</p>
        <p className="text-xs text-muted-foreground">Every booking has a technician assigned.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {bookings.map((b) => {
        const active = b.id === selectedBookingId;
        const badge = PRIORITY_BADGE[b.priority];
        return (
          <Card
            key={b.id}
            className={`group cursor-pointer p-3 transition ${
              active ? 'border-foreground/40 ring-2 ring-foreground/20' : 'hover:border-foreground/20'
            }`}
            onClick={() => onSelect(b.id)}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">{b.code}</span>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {b.customer.fullName} • {b.customer.phone}
                </p>
                <p className="text-xs text-muted-foreground">
                  {b.city.name} • {format(new Date(b.scheduledAt), 'EEE d MMM, HH:mm')}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={auto.isPending && auto.variables === b.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    auto.mutate(b.id);
                  }}
                >
                  {auto.isPending && auto.variables === b.id ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-1 h-3 w-3" />
                  )}
                  Auto-assign
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

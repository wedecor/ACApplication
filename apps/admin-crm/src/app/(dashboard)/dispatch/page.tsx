'use client';

import { useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';

import { ActivityFeed } from '@/components/dispatch/activity-feed';
import { AlertFeed } from '@/components/dispatch/alert-feed';
import { AvailabilityCard } from '@/components/dispatch/availability-card';
import { RecommendationsPanel } from '@/components/dispatch/recommendations-panel';
import { UnassignedQueue } from '@/components/dispatch/unassigned-queue';
import { useUnassignedQueue } from '@/hooks/use-dispatch';
import { useRealtime } from '@/hooks/use-realtime';

export default function DispatchControlCenterPage() {
  const params = useSearchParams();
  const initialBookingId = params.get('bookingId');
  const [cityId] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(initialBookingId);

  // Subscribe to the global dispatch room so the dashboard auto-refreshes.
  useRealtime({ rooms: ['dispatch:global'] });

  const queue = useUnassignedQueue(cityId);
  const recsRef = useRef<HTMLElement>(null);
  const selected = queue.data?.find((b) => b.id === selectedBookingId);

  // Below the 3-column layout the recommendations sit under the queue, so bring them into view.
  const selectBooking = (id: string) => {
    setSelectedBookingId(id);
    if (window.matchMedia('(max-width: 1279px)').matches) {
      requestAnimationFrame(() => recsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dispatch</h1>
          <p className="text-sm text-muted-foreground">
            Pick a booking to see ranked technicians, or auto-assign straight from the queue.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1.4fr_1fr]">
        <section className="flex flex-col gap-3">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Unassigned queue
            </h2>
            <span className="text-xs text-muted-foreground">
              {queue.data?.length ?? 0} bookings
            </span>
          </header>
          <UnassignedQueue
            bookings={queue.data ?? []}
            isLoading={queue.isLoading}
            selectedBookingId={selectedBookingId}
            onSelect={selectBooking}
          />
        </section>

        <section ref={recsRef} className="flex scroll-mt-20 flex-col gap-3">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Recommendations
            </h2>
            {selected ? (
              <span className="truncate text-xs text-muted-foreground">
                {selected.customer.fullName} · {selected.code}
              </span>
            ) : null}
          </header>
          <RecommendationsPanel bookingId={selectedBookingId} />
        </section>

        <section className="flex flex-col gap-3">
          <AvailabilityCard cityId={cityId} />
          <h2 className="text-sm font-semibold text-muted-foreground">
            Active alerts
          </h2>
          <AlertFeed cityId={cityId} />
          <ActivityFeed cityId={cityId} />
        </section>
      </div>
    </div>
  );
}

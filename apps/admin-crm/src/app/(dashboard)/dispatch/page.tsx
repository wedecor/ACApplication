'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

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

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dispatch Control Center</h1>
          <p className="text-sm text-muted-foreground">
            Real-time operational command — unassigned queue, smart recommendations and live alerts.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1.4fr_1fr]">
        <section className="flex flex-col gap-3">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
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
            onSelect={setSelectedBookingId}
          />
        </section>

        <section className="flex flex-col gap-3">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Dispatch recommendations
            </h2>
            {selectedBookingId ? (
              <code className="rounded bg-muted px-2 py-0.5 text-xs">{selectedBookingId}</code>
            ) : null}
          </header>
          <RecommendationsPanel bookingId={selectedBookingId} />
        </section>

        <section className="flex flex-col gap-3">
          <AvailabilityCard cityId={cityId} />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Active alerts
          </h2>
          <AlertFeed cityId={cityId} />
          <ActivityFeed cityId={cityId} />
        </section>
      </div>
    </div>
  );
}

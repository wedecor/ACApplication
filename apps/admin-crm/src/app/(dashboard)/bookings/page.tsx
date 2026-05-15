'use client';

import { EmptyState } from '@ac/ui';
import { CalendarCheck } from 'lucide-react';
import * as React from 'react';

import { Pagination } from '@/components/common/pagination';
import { BookingFilters } from '@/components/bookings/booking-filters';
import { BookingsTable } from '@/components/bookings/bookings-table';
import { useBookings } from '@/hooks/use-bookings';
import { useRealtime } from '@/hooks/use-realtime';
import type { BookingListQuery } from '@/lib/api/bookings';

export default function BookingsPage() {
  const [query, setQuery] = React.useState<BookingListQuery>({
    page: 1,
    pageSize: 20,
    sort: 'scheduledAt:asc',
  });
  const { data, isLoading, isFetching, error } = useBookings(query);
  useRealtime();

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Bookings</h1>
        <p className="text-sm text-muted-foreground">
          Operational view of every job — schedule, assign, dispatch and close out.
        </p>
      </header>

      <BookingFilters value={query} onChange={setQuery} />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load bookings. {(error as Error).message}
        </div>
      ) : items.length === 0 && !isLoading ? (
        <EmptyState
          icon={CalendarCheck}
          title="No bookings match the current filters"
          description="Tweak the filters above or convert a qualified lead to schedule a job."
        />
      ) : (
        <>
          <BookingsTable data={items} isLoading={isLoading || isFetching} />
          {data?.pagination ? (
            <Pagination
              page={data.pagination.page}
              pageSize={data.pagination.pageSize}
              total={data.pagination.total}
              totalPages={data.pagination.totalPages}
              onPageChange={(page) => setQuery((q) => ({ ...q, page }))}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

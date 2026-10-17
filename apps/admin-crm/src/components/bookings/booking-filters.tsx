'use client';

import { BookingPaymentStatus, BookingStatus } from '@ac/types';
import * as React from 'react';

import { ChipGroup, FilterPanel } from '@/components/common/filter-panel';
import type { BookingListQuery } from '@/lib/api/bookings';
import { humanizeEnum } from '@/lib/labels';

const STATUSES = Object.values(BookingStatus);
const PAYMENT_STATUSES = Object.values(BookingPaymentStatus);

export function BookingFilters({
  value,
  onChange,
}: {
  value: BookingListQuery;
  onChange: (next: BookingListQuery) => void;
}) {
  const [search, setSearch] = React.useState(value.search ?? '');

  React.useEffect(() => {
    const t = setTimeout(() => {
      if ((value.search ?? '') !== search) onChange({ ...value, search, page: 1 });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggle = <K extends keyof BookingListQuery>(key: K, item: string) => {
    const current = (value[key] as string[] | undefined) ?? [];
    const next = current.includes(item)
      ? current.filter((c) => c !== item)
      : [...current, item];
    onChange({ ...value, [key]: next.length ? next : undefined, page: 1 });
  };

  const clearAll = () => {
    setSearch('');
    onChange({ page: 1, pageSize: value.pageSize, sort: value.sort });
  };

  const activeCount = (value.status?.length ?? 0) + (value.paymentStatus?.length ?? 0);

  return (
    <FilterPanel
      search={search}
      onSearchChange={setSearch}
      searchLabel="Search bookings"
      searchPlaceholder="Code or customer"
      activeCount={activeCount}
      onReset={clearAll}
    >
      <ChipGroup
        label="Status"
        values={STATUSES}
        selected={value.status ?? []}
        onToggle={(v) => toggle('status', v)}
        format={humanizeEnum}
      />
      <ChipGroup
        label="Payment"
        values={PAYMENT_STATUSES}
        selected={value.paymentStatus ?? []}
        onToggle={(v) => toggle('paymentStatus', v)}
        format={humanizeEnum}
      />
    </FilterPanel>
  );
}

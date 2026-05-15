'use client';

import { BookingPaymentStatus, BookingStatus } from '@ac/types';
import { Badge, Button, Input } from '@ac/ui';
import { Search, X } from 'lucide-react';
import * as React from 'react';

import type { BookingListQuery } from '@/lib/api/bookings';

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

  const clearAll = () => onChange({ page: 1, pageSize: value.pageSize, sort: value.sort });

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search booking code or customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <X className="mr-1 size-4" /> Reset
        </Button>
      </div>
      <ChipRow
        label="Status"
        values={STATUSES}
        selected={value.status ?? []}
        onToggle={(v) => toggle('status', v)}
      />
      <ChipRow
        label="Payment"
        values={PAYMENT_STATUSES}
        selected={value.paymentStatus ?? []}
        onToggle={(v) => toggle('paymentStatus', v)}
      />
    </div>
  );
}

function ChipRow({
  label,
  values,
  selected,
  onToggle,
}: {
  label: string;
  values: readonly string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      {values.map((v) => {
        const isSelected = selected.includes(v);
        return (
          <button
            key={v}
            type="button"
            onClick={() => onToggle(v)}
            aria-pressed={isSelected}
            className="focus:outline-none"
          >
            <Badge variant={isSelected ? 'default' : 'outline'}>
              {v.replace(/_/g, ' ').toLowerCase()}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}

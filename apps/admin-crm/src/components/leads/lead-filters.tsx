'use client';

import { LeadPriority, LeadSource, LeadStatus } from '@ac/types';
import { Badge, Button, Input } from '@ac/ui';
import { Search, X } from 'lucide-react';
import * as React from 'react';

import type { LeadListQuery } from '@/lib/api/leads';

interface Props {
  value: LeadListQuery;
  onChange: (next: LeadListQuery) => void;
}

const STATUS_VALUES = Object.values(LeadStatus);
const SOURCE_VALUES = Object.values(LeadSource);
const PRIORITY_VALUES = Object.values(LeadPriority);

/**
 * Compact, dispatcher-friendly filter bar. Multi-select chip groups for the
 * common faceted filters, plus a debounced search.
 */
export function LeadFilters({ value, onChange }: Props) {
  const [search, setSearch] = React.useState(value.search ?? '');

  React.useEffect(() => {
    const t = setTimeout(() => {
      if ((value.search ?? '') !== search) onChange({ ...value, search, page: 1 });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggle = <K extends keyof LeadListQuery>(key: K, item: string) => {
    const current = (value[key] as string[] | undefined) ?? [];
    const next = current.includes(item)
      ? current.filter((c) => c !== item)
      : [...current, item];
    onChange({ ...value, [key]: next.length ? next : undefined, page: 1 });
  };

  const clearAll = () =>
    onChange({ page: 1, pageSize: value.pageSize, search: '', sort: value.sort });

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, email, code…"
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
        values={STATUS_VALUES}
        selected={value.status ?? []}
        onToggle={(v) => toggle('status', v)}
      />
      <ChipRow
        label="Source"
        values={SOURCE_VALUES}
        selected={value.source ?? []}
        onToggle={(v) => toggle('source', v)}
      />
      <ChipRow
        label="Priority"
        values={PRIORITY_VALUES}
        selected={value.priority ?? []}
        onToggle={(v) => toggle('priority', v)}
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

'use client';

import { LeadPriority, LeadSource, LeadStatus } from '@ac/types';
import * as React from 'react';

import { ChipGroup, FilterPanel } from '@/components/common/filter-panel';
import type { LeadListQuery } from '@/lib/api/leads';
import { humanizeEnum, leadSourceLabel } from '@/lib/labels';

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

  const clearAll = () => {
    setSearch('');
    onChange({ page: 1, pageSize: value.pageSize, search: '', sort: value.sort });
  };

  const activeCount =
    (value.status?.length ?? 0) + (value.source?.length ?? 0) + (value.priority?.length ?? 0);

  return (
    <FilterPanel
      search={search}
      onSearchChange={setSearch}
      searchLabel="Search leads"
      searchPlaceholder="Name, phone or code"
      activeCount={activeCount}
      onReset={clearAll}
    >
      <ChipGroup
        label="Status"
        values={STATUS_VALUES}
        selected={value.status ?? []}
        onToggle={(v) => toggle('status', v)}
        format={humanizeEnum}
      />
      <ChipGroup
        label="Source"
        values={SOURCE_VALUES}
        selected={value.source ?? []}
        onToggle={(v) => toggle('source', v)}
        format={leadSourceLabel}
      />
      <ChipGroup
        label="Priority"
        values={PRIORITY_VALUES}
        selected={value.priority ?? []}
        onToggle={(v) => toggle('priority', v)}
        format={humanizeEnum}
      />
    </FilterPanel>
  );
}

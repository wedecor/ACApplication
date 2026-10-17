'use client';

import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import * as React from 'react';

import { Button, Input } from '@ac/ui';

/**
 * List-page filter bar: an always-visible search plus facet groups that sit
 * behind a "Filters" toggle on phones and stay open from `md` up.
 */
export function FilterPanel({
  search,
  onSearchChange,
  searchPlaceholder,
  searchLabel = 'Search',
  activeCount,
  onReset,
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchLabel?: string;
  activeCount: number;
  onReset: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const panelId = React.useId();

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            aria-label={searchLabel}
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 md:hidden"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <SlidersHorizontal aria-hidden />
          Filters
          {activeCount > 0 ? (
            <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
          <ChevronDown className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </Button>
        {activeCount > 0 ? (
          <Button type="button" variant="ghost" className="hidden shrink-0 md:inline-flex" onClick={onReset}>
            <X aria-hidden /> Clear filters
          </Button>
        ) : null}
      </div>
      <div id={panelId} className={`${open ? 'block' : 'hidden'} space-y-3 md:block`}>
        {children}
        {activeCount > 0 ? (
          <Button type="button" variant="ghost" size="sm" className="md:hidden" onClick={onReset}>
            <X aria-hidden /> Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Multi-select toggle chips for one facet. */
export function ChipGroup<T extends string>({
  label,
  values,
  selected,
  onToggle,
  format,
}: {
  label: string;
  values: readonly T[];
  selected: readonly string[];
  onToggle: (value: T) => void;
  format: (value: T) => string;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">{label}</legend>
      <span aria-hidden className="w-full text-xs font-medium text-muted-foreground sm:w-16">
        {label}
      </span>
      {values.map((v) => {
        const isSelected = selected.includes(v);
        return (
          <button
            key={v}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggle(v)}
            className={`h-9 rounded-full border px-3 text-sm transition-colors ${
              isSelected
                ? 'border-primary bg-primary/10 font-medium text-primary'
                : 'bg-background text-foreground hover:bg-muted'
            }`}
          >
            {format(v)}
          </button>
        );
      })}
    </fieldset>
  );
}

'use client';

import { Input } from '@ac/ui';
import * as React from 'react';

import { useCustomersFiltered } from '@/hooks/use-customers';
import type { CustomerDetail } from '@/lib/api/customers';

/** Search-as-you-type customer picker. */
export function CustomerPicker({
  onPick,
  excludeIds = [],
  placeholder = 'Search customers by name or phone…',
  inputId,
}: {
  onPick: (c: CustomerDetail) => void;
  excludeIds?: string[];
  placeholder?: string;
  /** Lets a visible <Label htmlFor> point at the search input. */
  inputId?: string;
}) {
  const [draft, setDraft] = React.useState('');
  const [search, setSearch] = React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => setSearch(draft.trim()), 300);
    return () => clearTimeout(t);
  }, [draft]);
  const { data, isFetching } = useCustomersFiltered({ search: search || undefined, pageSize: 8 });
  const items = search ? (data?.items ?? []).filter((c) => !excludeIds.includes(c.id)) : [];

  return (
    <div className="relative">
      <Input
        id={inputId}
        type="search"
        aria-label={inputId ? undefined : 'Search customers'}
        autoComplete="off"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
      />
      {search ? (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md">
          {isFetching && items.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">Searching…</p>
          ) : items.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">No matches</p>
          ) : (
            items.map((c) => (
              <button
                key={c.id}
                type="button"
                className="block w-full px-3 py-2.5 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onPick(c);
                  setDraft('');
                  setSearch('');
                }}
              >
                <span className="font-medium">{c.fullName}</span>{' '}
                <span className="text-xs text-muted-foreground">{c.phone}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

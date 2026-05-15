'use client';

import { EmptyState, Input } from '@ac/ui';
import { Search, Users } from 'lucide-react';
import * as React from 'react';

import { Pagination } from '@/components/common/pagination';
import { CustomersTable } from '@/components/customers/customers-table';
import { useCustomers } from '@/hooks/use-customers';
import type { CustomerListQuery } from '@/lib/api/customers';

export default function CustomersPage() {
  const [query, setQuery] = React.useState<CustomerListQuery>({
    page: 1,
    pageSize: 20,
    sort: 'createdAt:desc',
  });
  const [searchDraft, setSearchDraft] = React.useState('');

  const { data, isLoading, isFetching, error } = useCustomers(query);
  const items = data?.items ?? [];
  const pagination = data?.pagination;

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery((q) => ({ ...q, page: 1, search: searchDraft.trim() || undefined }));
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">
          Household accounts with booking history, invoices, and support context.
        </p>
      </header>

      <form onSubmit={applySearch} className="flex max-w-md gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search name, phone, email…"
            className="pl-9"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Search
        </button>
      </form>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load customers. {(error as Error).message}
        </div>
      ) : items.length === 0 && !isLoading ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="Customers are created when leads convert to bookings. Check Leads for enquiries like LD-2026-000001."
        />
      ) : (
        <>
          <CustomersTable data={items} isLoading={isLoading || isFetching} />
          {pagination ? (
            <Pagination
              page={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              totalPages={pagination.totalPages}
              onPageChange={(page) => setQuery((q) => ({ ...q, page }))}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

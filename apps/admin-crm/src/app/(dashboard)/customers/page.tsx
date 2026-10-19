'use client';

import { Button, EmptyState, Input } from '@ac/ui';
import { Search, Users } from 'lucide-react';
import * as React from 'react';

import { Pagination } from '@/components/common/pagination';
import { CustomersTable } from '@/components/customers/customers-table';
import { NewCustomerButton } from '@/components/customers/new-customer-button';
import { useCustomers } from '@/hooks/use-customers';
import type { CustomerFilterQuery } from '@/lib/api/customers';

export default function CustomersPage() {
  const [query, setQuery] = React.useState<CustomerFilterQuery>({
    page: 1,
    pageSize: 20,
    sort: 'createdAt:desc',
  });
  const [searchDraft, setSearchDraft] = React.useState('');
  const [tagDraft, setTagDraft] = React.useState('');

  const { data, isLoading, isFetching, error } = useCustomers(query);
  const items = data?.items ?? [];
  const pagination = data?.pagination;

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery((q) => ({
      ...q,
      page: 1,
      search: searchDraft.trim() || undefined,
      tag: tagDraft.trim().toLowerCase() || undefined,
    }));
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Household accounts with booking history, invoices, and support context.
          </p>
        </div>
        <NewCustomerButton />
      </header>

      <form onSubmit={applySearch} role="search" className="flex max-w-xl flex-wrap gap-2">
        <div className="relative min-w-0 basis-full sm:flex-1 sm:basis-auto">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            aria-label="Search customers"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Name, phone or email"
            className="pl-9"
          />
        </div>
        <Input
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          placeholder="Tag"
          className="min-w-0 flex-1 sm:w-32 sm:flex-none"
          aria-label="Filter by tag"
        />
        <Button type="submit">Search</Button>
      </form>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load customers. {(error).message}
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

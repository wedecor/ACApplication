'use client';

import { EmptyState } from '@ac/ui';
import { Users } from 'lucide-react';
import * as React from 'react';

import { Pagination } from '@/components/common/pagination';
import { CreateLeadModal } from '@/components/leads/create-lead-modal';
import { LeadFilters } from '@/components/leads/lead-filters';
import { LeadsTable } from '@/components/leads/leads-table';
import { useLeads } from '@/hooks/use-leads';
import { useRealtime } from '@/hooks/use-realtime';
import type { LeadListQuery } from '@/lib/api/leads';

export default function LeadsPage() {
  const [query, setQuery] = React.useState<LeadListQuery>({
    page: 1,
    pageSize: 20,
    sort: 'createdAt:desc',
  });
  const { data, isLoading, isFetching, error } = useLeads(query);
  useRealtime();

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Pipeline of incoming customer enquiries — qualify and convert into bookings.
          </p>
        </div>
        <CreateLeadModal />
      </header>

      <LeadFilters value={query} onChange={setQuery} />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load leads. {(error as Error).message}
        </div>
      ) : items.length === 0 && !isLoading ? (
        <EmptyState
          icon={Users}
          title="No leads match the current filters"
          description="Try widening your filter set or create a new lead manually."
        />
      ) : (
        <>
          <LeadsTable data={items} isLoading={isLoading || isFetching} />
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

'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Plus, Repeat } from 'lucide-react';

import {
  Badge,
  Button,
  EmptyState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ac/ui';

import { LoadError } from '@/components/common/load-error';
import { Pagination } from '@/components/common/pagination';
import { useTransfers } from '@/hooks/use-inventory';
import { formatDateTime } from '@/lib/format';
import type { StockTransferStatus } from '@/lib/api/inventory';

const STATUSES: Array<{ id: StockTransferStatus | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'REQUESTED', label: 'Requested' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'IN_TRANSIT', label: 'In transit' },
  { id: 'RECEIVED', label: 'Received' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

const STATUS_VARIANT: Record<StockTransferStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'outline',
  REQUESTED: 'secondary',
  APPROVED: 'secondary',
  IN_TRANSIT: 'secondary',
  RECEIVED: 'default',
  CANCELLED: 'destructive',
  REJECTED: 'destructive',
};

export default function TransfersPage() {
  const [filters, setFilters] = React.useState<Record<string, unknown>>({ page: 1, pageSize: 20 });
  const { data, isLoading, error } = useTransfers(filters);
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Stock transfers</h1>
          <p className="text-sm text-muted-foreground">
            Move stock between warehouses with full approval, dispatch and receipt tracking.
          </p>
        </div>
        <Button asChild>
          <Link href="/transfers/new">
            <Plus className="size-4" />
            New transfer
          </Link>
        </Button>
      </header>

      <div className="flex flex-wrap gap-1">
        {STATUSES.map((s) => (
          <Button
            key={s.id}
            size="sm"
            variant={(filters.status ?? 'ALL') === s.id ? 'default' : 'outline'}
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                status: s.id === 'ALL' ? undefined : s.id,
                page: 1,
              }))
            }
          >
            {s.label}
          </Button>
        ))}
      </div>

      {error ? <LoadError label="transfers" message={(error as Error).message} /> : null}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Route</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Dispatched</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState
                    icon={Repeat}
                    title="No transfers yet"
                    description="Create a transfer to move stock between warehouses."
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    <Link href={`/transfers/${t.id}`} className="hover:underline">
                      {t.number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex items-center gap-1">
                      <span>{t.sourceWarehouse?.code}</span>
                      <ArrowRight className="size-3 text-muted-foreground" />
                      <span>{t.destWarehouse?.code}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{(t as { _count?: { items: number } })._count?.items ?? '—'}</TableCell>
                  <TableCell>{formatDateTime(t.requestedAt)}</TableCell>
                  <TableCell>{formatDateTime(t.dispatchedAt)}</TableCell>
                  <TableCell>{formatDateTime(t.receivedAt)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[t.status]}>{t.status.replace('_', ' ')}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.meta.totalPages > 1 ? (
        <Pagination
          page={data.meta.page}
          pageSize={data.meta.pageSize}
          total={data.meta.total}
          totalPages={data.meta.totalPages}
          onPageChange={(p) => setFilters((prev) => ({ ...prev, page: p }))}
        />
      ) : null}
    </div>
  );
}

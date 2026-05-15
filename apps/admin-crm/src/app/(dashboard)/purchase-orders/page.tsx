'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, ShoppingCart } from 'lucide-react';

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
import { usePurchaseOrders } from '@/hooks/use-inventory';
import { formatDate, formatMinor } from '@/lib/format';
import type { PurchaseOrderStatus } from '@/lib/api/inventory';

const STATUSES: Array<{ id: PurchaseOrderStatus | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'DRAFT', label: 'Draft' },
  { id: 'AWAITING_APPROVAL', label: 'Awaiting approval' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'ORDERED', label: 'Ordered' },
  { id: 'PARTIALLY_RECEIVED', label: 'Partial' },
  { id: 'RECEIVED', label: 'Received' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

const STATUS_VARIANT: Record<PurchaseOrderStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'outline',
  AWAITING_APPROVAL: 'secondary',
  APPROVED: 'secondary',
  ORDERED: 'secondary',
  PARTIALLY_RECEIVED: 'secondary',
  RECEIVED: 'default',
  CANCELLED: 'destructive',
  CLOSED: 'outline',
};

export default function PurchaseOrdersPage() {
  const [filters, setFilters] = React.useState<Record<string, unknown>>({ page: 1, pageSize: 20 });
  const { data, isLoading, error } = usePurchaseOrders(filters);
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Purchase orders</h1>
          <p className="text-sm text-muted-foreground">
            Draft, approve, dispatch and receive purchase orders against your vendors.
          </p>
        </div>
        <Button asChild>
          <Link href="/purchase-orders/new">
            <Plus className="size-4" />
            New PO
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

      {error ? <LoadError label="purchase orders" message={(error as Error).message} /> : null}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead className="text-right">Total</TableHead>
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
                    icon={ShoppingCart}
                    title="No purchase orders yet"
                    description="Create a PO to start procurement against a vendor."
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">
                    <Link href={`/purchase-orders/${po.id}`} className="hover:underline">
                      {po.number}
                    </Link>
                  </TableCell>
                  <TableCell>{po.vendor?.companyName ?? '—'}</TableCell>
                  <TableCell>{po.warehouse?.name ?? '—'}</TableCell>
                  <TableCell>{formatDate(po.createdAt)}</TableCell>
                  <TableCell>{formatDate(po.expectedAt)}</TableCell>
                  <TableCell className="text-right">{formatMinor(po.totalMinor)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[po.status]}>{po.status.replace('_', ' ')}</Badge>
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

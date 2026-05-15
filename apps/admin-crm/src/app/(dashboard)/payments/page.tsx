'use client';

import * as React from 'react';
import Link from 'next/link';
import { CreditCard } from 'lucide-react';

import {
  Badge,
  EmptyState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ac/ui';

import { Pagination } from '@/components/common/pagination';
import { usePaymentHistory } from '@/hooks/use-finance';
import type { PaymentTransactionStatus } from '@/lib/api/payments';
import { formatDateTime, formatMinor } from '@/lib/format';

const STATUS_FILTERS: Array<{ id: PaymentTransactionStatus | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'CREATED', label: 'Created' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'CAPTURED', label: 'Captured' },
  { id: 'FAILED', label: 'Failed' },
  { id: 'REFUNDED', label: 'Refunded' },
  { id: 'PARTIALLY_REFUNDED', label: 'Partial refund' },
];

const STATUS_BADGE: Record<PaymentTransactionStatus, 'default' | 'destructive' | 'outline' | 'secondary'> = {
  CREATED: 'outline',
  PENDING: 'secondary',
  AUTHORIZED: 'secondary',
  CAPTURED: 'default',
  FAILED: 'destructive',
  CANCELLED: 'outline',
  REFUNDED: 'destructive',
  PARTIALLY_REFUNDED: 'destructive',
};

export default function PaymentsPage() {
  const [filters, setFilters] = React.useState<{
    page?: number;
    pageSize?: number;
    status?: PaymentTransactionStatus;
  }>({ page: 1, pageSize: 25 });
  const { data, isLoading, error } = usePaymentHistory(filters);
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Every transaction from Razorpay, Stripe and manual entries — captured, failed, refunded.
        </p>
      </header>

      <div className="flex flex-wrap gap-1 rounded-md border bg-muted/30 p-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                status: f.id === 'ALL' ? undefined : (f.id as PaymentTransactionStatus),
                page: 1,
              }))
            }
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${
              (filters.status ?? 'ALL') === f.id
                ? 'bg-background text-foreground shadow'
                : 'text-muted-foreground hover:bg-background/60'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load payments. {(error as Error).message}
        </div>
      ) : items.length === 0 && !isLoading ? (
        <EmptyState
          icon={CreditCard}
          title="No transactions yet"
          description="Payment links generated from invoices will show up here as customers settle."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Captured</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, idx) => (
                    <TableRow key={idx}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Badge variant="outline">{p.provider.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>{p.customer?.fullName ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[p.status]}>{p.status}</Badge>
                      </TableCell>
                      <TableCell>{p.method ?? '—'}</TableCell>
                      <TableCell>{formatDateTime(p.capturedAt)}</TableCell>
                      <TableCell>
                        {p.invoiceId ? (
                          <Link
                            href={`/invoices/${p.invoiceId}`}
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            {p.invoiceId.slice(0, 8)}…
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMinor(p.amountMinor, p.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data?.meta ? (
        <Pagination
          page={data.meta.page}
          pageSize={data.meta.pageSize}
          total={data.meta.total}
          totalPages={data.meta.totalPages}
          onPageChange={(p: number) => setFilters((prev) => ({ ...prev, page: p }))}
        />
      ) : null}
    </div>
  );
}

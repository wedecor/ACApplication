'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, FileText, Plus, RotateCcw, Search, Send } from 'lucide-react';
import { useDebounce } from 'use-debounce';

import {
  Badge,
  Button,
  EmptyState,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ac/ui';

import { Pagination } from '@/components/common/pagination';
import { useInvoices } from '@/hooks/use-finance';
import type { Invoice, InvoiceStatus, ListInvoicesParams } from '@/lib/api/invoices';
import { invoicesApi } from '@/lib/api/invoices';
import { formatDate, formatMinor } from '@/lib/format';

const STATUS_FILTERS: Array<{ id: InvoiceStatus | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'DRAFT', label: 'Draft' },
  { id: 'SENT', label: 'Sent' },
  { id: 'PARTIALLY_PAID', label: 'Partial' },
  { id: 'PAID', label: 'Paid' },
  { id: 'OVERDUE', label: 'Overdue' },
  { id: 'REFUNDED', label: 'Refunded' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

const STATUS_BADGE: Record<InvoiceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'outline',
  SENT: 'secondary',
  PARTIALLY_PAID: 'secondary',
  PAID: 'default',
  OVERDUE: 'destructive',
  REFUNDED: 'destructive',
  CANCELLED: 'outline',
};

export default function InvoicesPage() {
  const router = useRouter();
  const [filters, setFilters] = React.useState<ListInvoicesParams>({ page: 1, pageSize: 20 });
  const [search, setSearch] = React.useState('');
  const [debouncedSearch] = useDebounce(search, 350);
  React.useEffect(() => {
    setFilters((f) => ({ ...f, q: debouncedSearch || undefined, page: 1 }));
  }, [debouncedSearch]);

  const { data, isLoading, error } = useInvoices(filters);
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Issue, send, collect and reconcile invoices across every booking and AMC contract.
          </p>
        </div>
        <Button onClick={() => router.push('/invoices/new')}>
          <Plus className="size-4" />
          New invoice
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by invoice number or notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-md border bg-muted/30 p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  status: f.id === 'ALL' ? undefined : (f.id as InvoiceStatus),
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
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load invoices. {(error as Error).message}
        </div>
      ) : items.length === 0 && !isLoading ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="Once you create an invoice from a booking or as ad-hoc billing it will appear here."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, idx) => (
                    <TableRow key={idx}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : items.map((inv) => <InvoiceRow key={inv.id} invoice={inv} />)}
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

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const router = useRouter();
  return (
    <TableRow
      className="cursor-pointer"
      onClick={() => router.push(`/invoices/${invoice.id}`)}
    >
      <TableCell className="font-medium">{invoice.number}</TableCell>
      <TableCell>{invoice.customer?.fullName ?? '—'}</TableCell>
      <TableCell>
        <Badge variant={STATUS_BADGE[invoice.status]}>{invoice.status}</Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMinor(invoice.totalMinor, invoice.currency)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-rose-600">
        {formatMinor(invoice.dueAmountMinor, invoice.currency)}
      </TableCell>
      <TableCell>{formatDate(invoice.dueDate)}</TableCell>
      <TableCell className="text-right">
        <div
          className="flex justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Link
            href={invoicesApi.downloadPdfUrl(invoice.id)}
            target="_blank"
            rel="noreferrer"
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Download PDF"
          >
            <Download className="size-4" />
          </Link>
          <button
            type="button"
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Send"
          >
            <Send className="size-4" />
          </button>
          <button
            type="button"
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Duplicate"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  );
}

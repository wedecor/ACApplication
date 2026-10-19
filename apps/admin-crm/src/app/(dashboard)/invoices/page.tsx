'use client';

import {
  Badge,
type BadgeProps,  Button,
  EmptyState,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow } from '@ac/ui';
import { Copy, Download, FileText, Plus, Search, Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';

import { Pagination } from '@/components/common/pagination';
import { useInvoiceAction, useInvoices } from '@/hooks/use-finance';
import type { Invoice, InvoiceStatus, ListInvoicesParams } from '@/lib/api/invoices';
import { downloadInvoicePdf } from '@/lib/api/invoices';
import { formatDate, formatMinor } from '@/lib/format';
import { humanizeEnum } from '@/lib/labels';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

const STATUS_FILTERS: { id: InvoiceStatus | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'DRAFT', label: 'Draft' },
  { id: 'SENT', label: 'Sent' },
  { id: 'PARTIALLY_PAID', label: 'Partial' },
  { id: 'PAID', label: 'Paid' },
  { id: 'OVERDUE', label: 'Overdue' },
  { id: 'REFUNDED', label: 'Refunded' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

const STATUS_BADGE: Record<InvoiceStatus, BadgeVariant> = {
  DRAFT: 'outline',
  SENT: 'info',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
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
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
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
          <Input aria-label="Search by invoice number or notes"
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
                  status: f.id === 'ALL' ? undefined : (f.id),
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
          Failed to load invoices. {(error).message}
        </div>
      ) : items.length === 0 && !isLoading ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="Once you create an invoice from a booking or as ad-hoc billing it will appear here."
        />
      ) : (
        <div className="rounded-lg border">
          <Table stackOnMobile>
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
  const actions = useInvoiceAction(invoice.id);
  const [downloading, setDownloading] = React.useState(false);

  const onDownload = async () => {
    setDownloading(true);
    try {
      await downloadInvoicePdf(invoice.id, invoice.number);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  const iconBtn = 'grid size-10 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50';

  return (
    <TableRow className="md:cursor-pointer" onClick={() => router.push(`/invoices/${invoice.id}`)}>
      <TableCell data-primary="" className="font-medium">
        <Link
          href={`/invoices/${invoice.id}`}
          onClick={(e) => e.stopPropagation()}
          className="hover:underline max-md:after:absolute max-md:after:inset-0"
        >
          {invoice.number}
        </Link>
      </TableCell>
      <TableCell>{invoice.customer?.fullName ?? '—'}</TableCell>
      <TableCell>
        <Badge variant={STATUS_BADGE[invoice.status]}>{humanizeEnum(invoice.status)}</Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMinor(invoice.totalMinor, invoice.currency)}
      </TableCell>
      <TableCell className={`text-right tabular-nums ${invoice.dueAmountMinor > 0 ? 'text-danger-700' : 'text-muted-foreground'}`}>
        {formatMinor(invoice.dueAmountMinor, invoice.currency)}
      </TableCell>
      <TableCell>{formatDate(invoice.dueDate)}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={iconBtn}
            aria-label={`Download ${invoice.number} as PDF`}
            title="Download PDF"
            disabled={downloading}
            onClick={() => void onDownload()}
          >
            <Download className="size-4" aria-hidden />
          </button>
          {invoice.status === 'DRAFT' ? (
            <button
              type="button"
              className={iconBtn}
              aria-label={`Send ${invoice.number} to customer`}
              title="Send to customer"
              disabled={actions.send.isPending}
              onClick={() =>
                actions.send.mutate(undefined, {
                  onSuccess: () => toast.success(`${invoice.number} sent`),
                  onError: (err) => toast.error((err).message),
                })
              }
            >
              <Send className="size-4" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            className={iconBtn}
            aria-label={`Duplicate ${invoice.number}`}
            title="Duplicate"
            disabled={actions.duplicate.isPending}
            onClick={() =>
              actions.duplicate.mutate(undefined, {
                onSuccess: (copy) => {
                  toast.success(`Created ${copy.number}`);
                  router.push(`/invoices/${copy.id}`);
                },
                onError: (err) => toast.error((err).message),
              })
            }
          >
            <Copy className="size-4" aria-hidden />
          </button>
        </div>
      </TableCell>
    </TableRow>
  );
}

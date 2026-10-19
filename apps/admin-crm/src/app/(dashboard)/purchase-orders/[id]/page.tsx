'use client';

import {
  Badge,
type BadgeProps,  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow } from '@ac/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

import { usePurchaseOrder, usePurchaseOrderActions } from '@/hooks/use-inventory';
import type { PurchaseOrderStatus } from '@/lib/api/inventory';
import { formatDate, formatMinor } from '@/lib/format';
import { humanizeEnum } from '@/lib/labels';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

const STATUS_VARIANT: Record<PurchaseOrderStatus, BadgeVariant> = {
  DRAFT: 'outline',
  AWAITING_APPROVAL: 'secondary',
  APPROVED: 'info',
  ORDERED: 'secondary',
  PARTIALLY_RECEIVED: 'secondary',
  RECEIVED: 'success',
  CANCELLED: 'destructive',
  CLOSED: 'outline',
};

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: po, isLoading, error } = usePurchaseOrder(id);
  const actions = usePurchaseOrderActions(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="space-y-4">
        <Link href="/purchase-orders" className="text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="inline size-4" /> Back
        </Link>
        <p className="text-sm text-destructive">
          {error ? (error).message : 'Purchase order not found'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/purchase-orders"
        className="-ml-2 inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Purchase orders
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {po.number}
            <Badge className="ml-2 align-middle" variant={STATUS_VARIANT[po.status]}>
              {humanizeEnum(po.status)}
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            {po.vendor?.companyName} → {po.warehouse?.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {po.status === 'DRAFT' ? (
            <Button
              size="sm"
              onClick={() =>
                actions.submit.mutate(undefined, {
                  onSuccess: () => toast.success('Submitted for approval'),
                  onError: (e) => toast.error((e).message),
                })
              }
              disabled={actions.submit.isPending}
            >
              Submit
            </Button>
          ) : null}
          {po.status === 'AWAITING_APPROVAL' ? (
            <Button
              size="sm"
              onClick={() =>
                actions.approve.mutate(undefined, {
                  onSuccess: () => toast.success('Approved'),
                  onError: (e) => toast.error((e).message),
                })
              }
              disabled={actions.approve.isPending}
            >
              Approve
            </Button>
          ) : null}
          {po.status === 'APPROVED' ? (
            <Button
              size="sm"
              onClick={() =>
                actions.order.mutate(undefined, {
                  onSuccess: () => toast.success('Marked as ordered'),
                  onError: (e) => toast.error((e).message),
                })
              }
              disabled={actions.order.isPending}
            >
              Mark ordered
            </Button>
          ) : null}
          {!['RECEIVED', 'CANCELLED', 'CLOSED'].includes(po.status) ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                actions.cancel.mutate('Cancelled from CRM', {
                  onSuccess: () => toast.success('Cancelled'),
                  onError: (e) => toast.error((e).message),
                })
              }
              disabled={actions.cancel.isPending}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </header>

      <dl className="grid grid-cols-3 divide-x rounded-lg border bg-card">
        <div className="min-w-0 px-3 py-3 sm:px-5">
          <dt className="text-sm text-muted-foreground">Total</dt>
          <dd className="mt-0.5 truncate text-lg font-semibold tabular-nums sm:text-2xl">{formatMinor(po.totalMinor)}</dd>
        </div>
        <div className="min-w-0 px-3 py-3 sm:px-5">
          <dt className="text-sm text-muted-foreground">Created</dt>
          <dd className="mt-0.5 text-sm sm:text-base">{formatDate(po.createdAt)}</dd>
        </div>
        <div className="min-w-0 px-3 py-3 sm:px-5">
          <dt className="text-sm text-muted-foreground">Expected</dt>
          <dd className="mt-0.5 text-sm sm:text-base">{po.expectedAt ? formatDate(po.expectedAt) : '—'}</dd>
        </div>
      </dl>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table stackOnMobile>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead className="text-right">Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(po.items ?? []).map((line) => (
                <TableRow key={line.id ?? line.itemId}>
                  <TableCell>
                    <p className="font-medium">{line.item?.name ?? line.itemId}</p>
                    <p className="font-mono text-xs text-muted-foreground">{line.item?.sku}</p>
                  </TableCell>
                  <TableCell className="text-right">{line.quantity}</TableCell>
                  <TableCell className="text-right">{line.receivedQty}</TableCell>
                  <TableCell className="text-right">{formatMinor(line.unitCostMinor)}</TableCell>
                  <TableCell className="text-right">{formatMinor(line.totalMinor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {po.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{po.notes}</CardContent>
        </Card>
      ) : null}
    </div>
  );
}

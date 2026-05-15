'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import {
  Badge,
  Button,
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
  TableRow,
} from '@ac/ui';

import { useTransfer, useTransferActions } from '@/hooks/use-inventory';
import { formatDate } from '@/lib/format';
import type { StockTransferStatus } from '@/lib/api/inventory';

const STATUS_VARIANT: Record<
  StockTransferStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  DRAFT: 'outline',
  REQUESTED: 'secondary',
  APPROVED: 'secondary',
  IN_TRANSIT: 'secondary',
  RECEIVED: 'default',
  CANCELLED: 'destructive',
  REJECTED: 'destructive',
};

export default function TransferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: transfer, isLoading, error } = useTransfer(id);
  const actions = useTransferActions(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !transfer) {
    return (
      <div className="space-y-4">
        <Link href="/transfers" className="text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="inline size-4" /> Back
        </Link>
        <p className="text-sm text-destructive">
          {error ? (error as Error).message : 'Transfer not found'}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <Link href="/transfers" className="text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="inline size-4" /> Back to transfers
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Transfer {transfer.number}
            <Badge className="ml-2 align-middle" variant={STATUS_VARIANT[transfer.status]}>
              {transfer.status.replace(/_/g, ' ')}
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            {transfer.sourceWarehouse?.name} → {transfer.destWarehouse?.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['DRAFT', 'REQUESTED'].includes(transfer.status) ? (
            <Button
              size="sm"
              onClick={() =>
                actions.approve.mutate(undefined, {
                  onSuccess: () => toast.success('Approved'),
                  onError: (e) => toast.error((e as Error).message),
                })
              }
              disabled={actions.approve.isPending}
            >
              Approve
            </Button>
          ) : null}
          {transfer.status === 'APPROVED' ? (
            <Button
              size="sm"
              onClick={() =>
                actions.dispatch.mutate(undefined, {
                  onSuccess: () => toast.success('Dispatched'),
                  onError: (e) => toast.error((e as Error).message),
                })
              }
              disabled={actions.dispatch.isPending}
            >
              Dispatch
            </Button>
          ) : null}
          {!['RECEIVED', 'CANCELLED', 'REJECTED'].includes(transfer.status) ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                actions.cancel.mutate('Cancelled from CRM', {
                  onSuccess: () => toast.success('Cancelled'),
                  onError: (e) => toast.error((e as Error).message),
                })
              }
              disabled={actions.cancel.isPending}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </header>

      <p className="text-sm text-muted-foreground">
        Requested {formatDate(transfer.requestedAt)}
        {transfer.receivedAt ? ` · Received ${formatDate(transfer.receivedAt)}` : null}
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Requested</TableHead>
                <TableHead className="text-right">Dispatched</TableHead>
                <TableHead className="text-right">Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(transfer.items ?? []).map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <p className="font-medium">{line.item?.name ?? line.itemId}</p>
                    <p className="font-mono text-xs text-muted-foreground">{line.item?.sku}</p>
                  </TableCell>
                  <TableCell className="text-right">{line.requestedQty}</TableCell>
                  <TableCell className="text-right">{line.dispatchedQty}</TableCell>
                  <TableCell className="text-right">{line.receivedQty}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {transfer.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{transfer.notes}</CardContent>
        </Card>
      ) : null}
    </section>
  );
}

'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Wallet } from 'lucide-react';

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

import { usePayoutAction, usePayouts } from '@/hooks/use-finance';
import type { PayoutStatus, TechnicianPayout } from '@/lib/api/payouts';
import { formatDate, formatMinor } from '@/lib/format';

const FILTERS: Array<{ id: PayoutStatus | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'PROCESSING', label: 'Processing' },
  { id: 'PAID', label: 'Paid' },
  { id: 'FAILED', label: 'Failed' },
];

const BADGE: Record<PayoutStatus, 'default' | 'destructive' | 'outline' | 'secondary'> = {
  PENDING: 'secondary',
  APPROVED: 'secondary',
  PROCESSING: 'secondary',
  PAID: 'default',
  FAILED: 'destructive',
  CANCELLED: 'outline',
};

export default function PayoutsPage() {
  const [status, setStatus] = React.useState<PayoutStatus | undefined>(undefined);
  const { data, isLoading, error } = usePayouts({ status });
  const items = data ?? [];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Payouts</h1>
        <p className="text-sm text-muted-foreground">
          Technician payout cycles — approve, process, and reconcile.
        </p>
      </header>

      <div className="flex flex-wrap gap-1 rounded-md border bg-muted/30 p-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setStatus(f.id === 'ALL' ? undefined : (f.id as PayoutStatus))}
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${
              (status ?? 'ALL') === f.id
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
          Failed to load payouts. {(error as Error).message}
          {(error as Error).message.includes('UNAUTHORIZED') ? (
            <p className="mt-2 font-normal text-muted-foreground">
              Your session may have expired.{' '}
              <a href="/login?next=%2Fpayouts" className="font-medium text-primary underline">
                Sign in again
              </a>
              .
            </p>
          ) : null}
        </div>
      ) : items.length === 0 && !isLoading ? (
        <EmptyState
          icon={Wallet}
          title="No payouts yet"
          description="Once a payout cycle is closed for a technician it will appear here for approval."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Technician</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Jobs</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, idx) => (
                    <TableRow key={idx}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : items.map((p) => <PayoutRow key={p.id} payout={p} />)}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function PayoutRow({ payout }: { payout: TechnicianPayout }) {
  const actions = usePayoutAction(payout.id);
  const technicianName = payout.technician?.user
    ? `${payout.technician.user.firstName} ${payout.technician.user.lastName}`
    : payout.technicianId;
  return (
    <TableRow>
      <TableCell className="font-medium">{payout.code}</TableCell>
      <TableCell>{technicianName}</TableCell>
      <TableCell>
        {formatDate(payout.periodStart)} → {formatDate(payout.periodEnd)}
      </TableCell>
      <TableCell className="text-right tabular-nums">{payout.jobsCount}</TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMinor(payout.netMinor, payout.currency)}
      </TableCell>
      <TableCell>
        <Badge variant={BADGE[payout.status]}>{payout.status}</Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          {payout.status === 'PENDING' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                actions.approve.mutate(undefined, {
                  onSuccess: () => toast.success('Payout approved'),
                })
              }
              disabled={actions.approve.isPending}
            >
              <CheckCircle2 className="size-4" />
              Approve
            </Button>
          )}
          {(payout.status === 'APPROVED' || payout.status === 'PROCESSING') && (
            <Button
              size="sm"
              onClick={() =>
                actions.markPaid.mutate(
                  { paymentRef: '' },
                  { onSuccess: () => toast.success('Marked as paid') },
                )
              }
              disabled={actions.markPaid.isPending}
            >
              Mark paid
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

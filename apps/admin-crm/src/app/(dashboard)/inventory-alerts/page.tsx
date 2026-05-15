'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

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

import { useAlertActions, useInventoryAlerts } from '@/hooks/use-inventory';
import { formatDateTime } from '@/lib/format';

const SEVERITY_VARIANT: Record<'INFO' | 'WARNING' | 'CRITICAL', 'default' | 'secondary' | 'destructive'> = {
  INFO: 'default',
  WARNING: 'secondary',
  CRITICAL: 'destructive',
};

export default function InventoryAlertsPage() {
  const [status, setStatus] = React.useState<string>('OPEN');
  const { data, isLoading } = useInventoryAlerts({ status, page: 1, pageSize: 50 });
  const { acknowledge, resolve, scan } = useAlertActions();
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Inventory alerts</h1>
          <p className="text-sm text-muted-foreground">
            Low-stock, expiring batches, slow movers, overdue POs and technician mismatches.
          </p>
        </div>
        <Button onClick={() => scan.mutate()} disabled={scan.isPending}>
          <RefreshCw className="size-4" />
          Re-scan now
        </Button>
      </header>

      <div className="flex flex-wrap gap-1">
        {['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'SNOOZED'].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? 'default' : 'outline'}
            onClick={() => setStatus(s)}
          >
            {s}
          </Button>
        ))}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Severity</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="text-right">Observed</TableHead>
              <TableHead className="text-right">Threshold</TableHead>
              <TableHead>Raised</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
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
                    icon={CheckCircle2}
                    title="No alerts in this state"
                    description="Inventory is operating within thresholds."
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Badge variant={SEVERITY_VARIANT[a.severity]}>{a.severity}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline">{a.kind.replace(/_/g, ' ')}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="size-3.5 text-muted-foreground" />
                      {a.title}
                    </div>
                    {a.item ? (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        SKU {a.item.sku} · {a.item.name}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">{a.observedValue ?? '—'}</TableCell>
                  <TableCell className="text-right">{a.thresholdValue ?? '—'}</TableCell>
                  <TableCell>{formatDateTime(a.createdAt)}</TableCell>
                  <TableCell className="space-x-1 text-right">
                    {a.status === 'OPEN' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => acknowledge.mutate(a.id)}
                        disabled={acknowledge.isPending}
                      >
                        Ack
                      </Button>
                    ) : null}
                    {a.status !== 'RESOLVED' ? (
                      <Button
                        size="sm"
                        onClick={() => resolve.mutate(a.id)}
                        disabled={resolve.isPending}
                      >
                        Resolve
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

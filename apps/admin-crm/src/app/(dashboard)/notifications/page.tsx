'use client';

import * as React from 'react';
import { Activity, AlertTriangle, Bell, RotateCcw } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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

import {
  useDlqJobs,
  useNotificationDashboard,
  useNotificationTimeline,
  useNotifications,
  useRetryDlq,
  useRetryNotification,
} from '@/hooks/use-notifications';
import type { NotificationLogStatus } from '@/lib/api/notifications';
import { formatDate } from '@/lib/format';

const STATUS_FILTERS: Array<{ id: NotificationLogStatus | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'QUEUED', label: 'Queued' },
  { id: 'PROCESSING', label: 'Processing' },
  { id: 'RETRYING', label: 'Retrying' },
  { id: 'SENT', label: 'Sent' },
  { id: 'FAILED', label: 'Failed' },
  { id: 'DLQ', label: 'DLQ' },
];

const STATUS_BADGE: Record<
  NotificationLogStatus,
  'default' | 'destructive' | 'outline' | 'secondary'
> = {
  QUEUED: 'secondary',
  PROCESSING: 'outline',
  RETRYING: 'outline',
  SENT: 'default',
  DELIVERED: 'default',
  READ: 'outline',
  FAILED: 'destructive',
  DLQ: 'destructive',
};

export default function NotificationsPage() {
  const [status, setStatus] = React.useState<NotificationLogStatus | undefined>(undefined);
  const [search, setSearch] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const { data: dashboard } = useNotificationDashboard();
  const { data, isLoading, error } = useNotifications({ status, search: search || undefined });
  const { data: dlq } = useDlqJobs();
  const { data: timeline } = useNotificationTimeline(selectedId);
  const retry = useRetryNotification();
  const retryDlq = useRetryDlq();
  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Delivery logs, queue health, provider circuits, and DLQ management.
        </p>
      </header>

      {dashboard ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Queue waiting"
            value={String(dashboard.queue.main.waiting)}
            sub={dashboard.queue.main.paused ? 'Paused' : 'Active'}
          />
          <MetricCard
            title="DLQ jobs"
            value={String(dashboard.queue.dlq.waiting + dashboard.queue.dlq.failed)}
            sub="Dead letter"
          />
          <MetricCard
            title="Kill switch"
            value={dashboard.killSwitch ? 'ON' : 'OFF'}
            sub={dashboard.killSwitch ? 'Dispatch blocked' : 'Normal'}
            alert={dashboard.killSwitch}
          />
          <MetricCard
            title="Open circuits"
            value={String(dashboard.providers.filter((p) => p.snapshot.state === 'open').length)}
            sub={`${dashboard.providers.length} providers tracked`}
          />
        </div>
      ) : (
        <Skeleton className="h-24 w-full" />
      )}

      {dashboard?.providers.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Provider health</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {dashboard.providers.map((p) => (
              <Badge
                key={`${p.channel}-${p.provider}`}
                variant={p.snapshot.state === 'open' ? 'destructive' : 'secondary'}
              >
                {p.channel}/{p.provider}: {p.snapshot.state} ({p.snapshot.failures} failures)
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 rounded-md border bg-muted/30 p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatus(f.id === 'ALL' ? undefined : f.id)}
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
        <Input
          placeholder="Search template, phone, correlation…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load notifications. {(error as Error).message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No notifications yet"
              description="Outbound messages appear here once domain events enqueue delivery jobs."
            />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow
                      key={row.id}
                      className={selectedId === row.id ? 'bg-muted/50' : 'cursor-pointer'}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(row.createdAt)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.channel}</TableCell>
                      <TableCell className="max-w-[140px] truncate text-sm">{row.template}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[row.status]}>{row.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {(row.status === 'FAILED' || row.status === 'DLQ') && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={retry.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              retry.mutate(row.id);
                            }}
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" />
                            Retry
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Activity className="h-4 w-4" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!selectedId ? (
                <p className="text-muted-foreground">Select a notification to view its lifecycle.</p>
              ) : !timeline?.events.length ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                timeline.events.map((ev) => (
                  <div key={ev.id} className="border-l-2 border-primary/30 pl-3">
                    <p className="font-medium">{ev.status}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(ev.createdAt)}</p>
                    {ev.detail ? <p className="text-xs">{ev.detail}</p> : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4" />
                Dead letter queue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(dlq ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No DLQ jobs.</p>
              ) : (
                (dlq ?? []).map((job) => (
                  <div key={job.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-mono">{job.notificationId}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={retryDlq.isPending}
                      onClick={() => retryDlq.mutate(job.id)}
                    >
                      Retry
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  sub,
  alert,
}: {
  title: string;
  value: string;
  sub: string;
  alert?: boolean;
}) {
  return (
    <Card className={alert ? 'border-destructive/50' : undefined}>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}


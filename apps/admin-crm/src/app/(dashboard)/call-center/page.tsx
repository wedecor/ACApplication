'use client';

import * as React from 'react';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Plus } from 'lucide-react';

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
import {
  useCallActions,
  useCalls,
  useCallCenterStats,
  useMissedCallQueue,
} from '@/hooks/use-support';
import type { CallStatus, CallSummary } from '@/lib/api/support';
import { formatDateTime } from '@/lib/format';

const STATUS_VARIANT: Record<CallStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  QUEUED: 'outline',
  RINGING: 'secondary',
  IN_PROGRESS: 'default',
  COMPLETED: 'outline',
  MISSED: 'destructive',
  NO_ANSWER: 'destructive',
  BUSY: 'destructive',
  FAILED: 'destructive',
  ABANDONED: 'destructive',
  VOICEMAIL: 'secondary',
};

const DAY_MS = 86_400_000;

export default function CallCenterPage() {
  const range = React.useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * DAY_MS);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [missedOnly, setMissedOnly] = React.useState(false);

  const stats = useCallCenterStats(range);
  const calls = useCalls({
    page,
    pageSize: 25,
    search: search || undefined,
    missed: missedOnly ? 'true' : undefined,
  });
  const missed = useMissedCallQueue();
  const actions = useCallActions();

  const [c2cNumber, setC2cNumber] = React.useState('');

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Phone className="size-5" />
            Call center
          </h1>
          <p className="text-sm text-muted-foreground">
            Live agent calls, missed-call recovery and Exotel / Twilio integration.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="+91 99…"
            value={c2cNumber}
            onChange={(e) => setC2cNumber(e.target.value)}
            className="w-48"
          />
          <Button
            disabled={!c2cNumber || actions.clickToCall.isPending}
            onClick={() =>
              actions.clickToCall.mutate(
                { toNumber: c2cNumber },
                { onSuccess: () => setC2cNumber('') },
              )
            }
          >
            <Plus className="size-4" />
            Click-to-call
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Calls (30d)" value={stats.data?.total ?? 0} loading={stats.isLoading} />
        <Kpi
          label="Missed"
          value={stats.data?.missed ?? 0}
          sub={stats.data ? `${stats.data.missedRate.toFixed(1)}% miss-rate` : undefined}
          loading={stats.isLoading}
          tone="destructive"
        />
        <Kpi
          label="Avg duration"
          value={stats.data ? `${Math.round(stats.data.avgDurationSeconds)}s` : '0s'}
          loading={stats.isLoading}
        />
        <Kpi label="Missed queue" value={missed.data?.length ?? 0} loading={missed.isLoading} />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="lg:col-span-1">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Missed call queue
          </h2>
          <div className="space-y-2">
            {missed.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : missed.data && missed.data.length > 0 ? (
              missed.data.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-md border bg-card p-2"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {c.customer?.fullName ?? c.fromNumber}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(c.startedAt)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      actions.clickToCall.mutate({
                        toNumber: c.fromNumber,
                        customerId: c.customerId ?? undefined,
                      })
                    }
                  >
                    Call back
                  </Button>
                </div>
              ))
            ) : (
              <EmptyState title="Empty" description="No missed calls right now." />
            )}
          </div>
        </section>

        <section className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Call log
            </h2>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search number / agent"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56"
              />
              <Button
                size="sm"
                variant={missedOnly ? 'destructive' : 'outline'}
                onClick={() => {
                  setMissedOnly((p) => !p);
                  setPage(1);
                }}
              >
                Missed only
              </Button>
            </div>
          </div>

          {calls.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (calls.data?.items.length ?? 0) === 0 ? (
            <EmptyState title="No calls" description="No call activity matches your filter." />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Customer / number</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((calls.data?.items ?? []) as CallSummary[]).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.number}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {c.customer?.fullName ?? (c.direction === 'INBOUND' ? c.fromNumber : c.toNumber)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {c.direction === 'INBOUND' ? c.fromNumber : c.toNumber}
                        </div>
                      </TableCell>
                      <TableCell>
                        {c.direction === 'INBOUND' ? (
                          <Badge variant="outline" className="gap-1">
                            <PhoneIncoming className="size-3" /> In
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <PhoneOutgoing className="size-3" /> Out
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[c.status]}>
                          {c.status === 'MISSED' ? (
                            <span className="inline-flex items-center gap-1">
                              <PhoneMissed className="size-3" /> Missed
                            </span>
                          ) : (
                            c.status.replace('_', ' ')
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {c.agent
                          ? `${c.agent.firstName ?? ''} ${c.agent.lastName ?? ''}`.trim() || '—'
                          : '—'}
                      </TableCell>
                      <TableCell className="tabular-nums">{c.durationS ?? '—'}s</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(c.startedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {calls.data ? (
            <Pagination
              page={calls.data.meta.page}
              pageSize={calls.data.meta.pageSize}
              total={calls.data.meta.total}
              totalPages={calls.data.meta.totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  loading,
  tone,
}: {
  label: string;
  value: number | string;
  sub?: string;
  loading?: boolean;
  tone?: 'destructive';
}) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <div
          className={`mt-1 text-2xl font-semibold tabular-nums ${
            tone === 'destructive' ? 'text-destructive' : ''
          }`}
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
      )}
      {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

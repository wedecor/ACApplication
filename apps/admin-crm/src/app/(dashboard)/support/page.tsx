'use client';

import * as React from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  Headphones,
  PhoneCall,
  Star,
  Timer,
} from 'lucide-react';

import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@ac/ui';

import {
  useChannelBreakdown,
  useCallCenterStats,
  useResponseTimes,
  useSupportOverview,
} from '@/hooks/use-support';

const DAY_MS = 86_400_000;

export default function SupportOverviewPage() {
  const range = React.useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * DAY_MS);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  const overview = useSupportOverview(range);
  const responseTimes = useResponseTimes(range);
  const channels = useChannelBreakdown(range);
  const callStats = useCallCenterStats(range);

  const o = overview.data;
  const fr = responseTimes.data?.firstResponseSeconds;
  const res = responseTimes.data?.resolutionSeconds;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Support overview</h1>
          <p className="text-sm text-muted-foreground">
            Last 30 days of tickets, responses, SLA performance and call activity.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Headphones className="size-3.5" />
          Omnichannel
        </Badge>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Tickets created"
          value={o?.totals.created}
          icon={<Headphones className="size-4" />}
          loading={overview.isLoading}
        />
        <Kpi
          label="Currently open"
          value={o?.totals.open}
          icon={<AlertOctagon className="size-4" />}
          loading={overview.isLoading}
        />
        <Kpi
          label="Resolved"
          value={o?.totals.resolved}
          sub={
            o
              ? `${o.totals.resolutionRate.toFixed(1)}% resolution rate`
              : undefined
          }
          icon={<CheckCircle2 className="size-4" />}
          loading={overview.isLoading}
        />
        <Kpi
          label="Avg CSAT"
          value={o?.csat.count ? `${o.csat.averageRating.toFixed(2)} / 5` : '—'}
          sub={o?.csat.count ? `${o.csat.count} ratings` : undefined}
          icon={<Star className="size-4" />}
          loading={overview.isLoading}
        />
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">First response</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-sm">
            <Metric label="Avg" value={fr ? formatDuration(fr.avg) : '—'} />
            <Metric label="P50" value={fr ? formatDuration(fr.p50) : '—'} />
            <Metric label="P90" value={fr ? formatDuration(fr.p90) : '—'} />
            {o ? (
              <div className="col-span-3 mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Timer className="size-3.5" />
                {o.sla.firstResponse.met} of{' '}
                {o.sla.firstResponse.met + o.sla.firstResponse.missed} met SLA (
                {o.sla.firstResponse.rate.toFixed(1)}%)
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resolution</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-sm">
            <Metric label="Avg" value={res ? formatDuration(res.avg) : '—'} />
            <Metric label="P50" value={res ? formatDuration(res.p50) : '—'} />
            <Metric label="P90" value={res ? formatDuration(res.p90) : '—'} />
            {o ? (
              <div className="col-span-3 mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="size-3.5" />
                {o.sla.resolution.met} of{' '}
                {o.sla.resolution.met + o.sla.resolution.missed} met SLA (
                {o.sla.resolution.rate.toFixed(1)}%)
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Channel mix</CardTitle>
          </CardHeader>
          <CardContent>
            {channels.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="space-y-2 text-sm">
                {channels.data &&
                  Object.entries(channels.data).map(([channel, stats]) => (
                    <div key={channel} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                      <span>{channel.replace('_', ' ')}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {stats.conversations} conversations · {stats.inbound} in /{' '}
                        {stats.outbound} out
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Call center</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="flex items-center gap-2">
                <PhoneCall className="size-3.5" />
                Total calls
              </span>
              <span className="tabular-nums">{callStats.data?.total ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span>Missed</span>
              <span className="tabular-nums text-destructive">
                {callStats.data?.missed ?? 0} ({callStats.data?.missedRate?.toFixed(1) ?? '0'}%)
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span>Avg duration</span>
              <span className="tabular-nums">
                {callStats.data ? formatDuration(callStats.data.avgDurationSeconds) : '—'}
              </span>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon,
  loading,
}: {
  label: string;
  value?: number | string | null;
  sub?: string;
  icon?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
          <span>{label}</span>
          {icon ? <span className="text-muted-foreground/70">{icon}</span> : null}
        </div>
        {loading ? (
          <Skeleton className="mt-3 h-8 w-24" />
        ) : (
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {typeof value === 'number' ? value.toLocaleString() : value ?? '—'}
          </div>
        )}
        {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds)) return '0s';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (hours < 24) return `${hours}h ${minutes}m`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return `${days}d ${restHours}h`;
}

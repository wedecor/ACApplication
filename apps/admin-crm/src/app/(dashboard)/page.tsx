'use client';

import { Permission } from '@ac/types';
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@ac/ui';
import { AlertTriangle, CalendarCheck, ChevronRight, IndianRupee, type LucideIcon, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { useBookings } from '@/hooks/use-bookings';
import { useDispatchAlerts, useRecentDecisions, useUnassignedQueue } from '@/hooks/use-dispatch';
import { useFinanceOverview } from '@/hooks/use-finance';
import { useAvailability } from '@/hooks/use-tracking';
import { formatMinor, formatWhen } from '@/lib/format';
import { hasPermission, readSessionClaims } from '@/lib/rbac/permissions';

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

const PRIORITY_VARIANT = { EMERGENCY: 'destructive', PRIORITY: 'warning', STANDARD: 'muted' } as const;

const DECISION_LABEL: Record<string, string> = {
  AUTO_ASSIGNED: 'Auto-assigned',
  MANUAL_ASSIGNED: 'Assigned',
  REASSIGNED: 'Reassigned',
  REJECTED: 'Rejected',
};

export default function DashboardPage() {
  const { permissions } = readSessionClaims();
  const can = (p: Permission) => hasPermission(p, permissions);
  const range = useMemo(todayRange, []);

  const canBookings = can(Permission.BOOKING_READ);
  const canDispatch = can(Permission.DISPATCH_VIEW);
  const canTrack = can(Permission.TECHNICIAN_TRACK);
  const canFinance = can(Permission.FINANCE_VIEW);

  const bookingsToday = useBookings({ scheduledFrom: range.from, scheduledTo: range.to, pageSize: 1 });
  const availability = useAvailability(null);
  const finance = useFinanceOverview(range);
  const alerts = useDispatchAlerts(null);
  const unassigned = useUnassignedQueue(null);
  const decisions = useRecentDecisions(null);

  const openAlerts = (alerts.data ?? []).filter((a) => !a.acknowledgedAt);
  const criticalAlerts = openAlerts.filter((a) => a.severity === 'critical').length;
  const buckets = availability.data?.buckets;
  const fleet = buckets ? Object.values(buckets).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Operations overview</h1>
        <p className="text-sm text-muted-foreground">Today across every city. Tap a figure to drill in.</p>
      </header>

      <section aria-label="Today at a glance" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {canBookings ? (
          <Metric
            href="/bookings"
            label="Bookings today"
            icon={CalendarCheck}
            loading={bookingsToday.isLoading}
            error={bookingsToday.isError}
            value={String(bookingsToday.data?.pagination.total ?? 0)}
          />
        ) : null}
        {canTrack ? (
          <Metric
            href="/technicians"
            label="Technicians free"
            icon={Wrench}
            loading={availability.isLoading}
            error={availability.isError}
            value={String(buckets?.available ?? 0)}
            hint={buckets ? `${buckets.engaged} on jobs · ${fleet} total` : undefined}
          />
        ) : null}
        {canFinance ? (
          <Metric
            href="/finance"
            label="Collected today"
            icon={IndianRupee}
            loading={finance.isLoading}
            error={finance.isError}
            value={formatMinor(finance.data?.collectedMinor ?? 0)}
          />
        ) : null}
        {canDispatch ? (
          <Metric
            href="/dispatch"
            label="Open alerts"
            icon={AlertTriangle}
            loading={alerts.isLoading}
            error={alerts.isError}
            value={String(openAlerts.length)}
            hint={criticalAlerts ? `${criticalAlerts} critical` : undefined}
            tone={criticalAlerts ? 'danger' : undefined}
          />
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {canDispatch ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Needs a technician</CardTitle>
              <Link href="/dispatch" className="text-sm font-medium text-primary hover:underline">
                Open dispatch
              </Link>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              <ListState
                loading={unassigned.isLoading}
                error={unassigned.isError}
                empty={(unassigned.data ?? []).length === 0}
                emptyText="Every booking has a technician."
              >
                <ul className="divide-y">
                  {(unassigned.data ?? []).slice(0, 6).map((b) => (
                    <li key={b.id}>
                      <Link
                        href={`/bookings/${b.id}`}
                        className="flex items-center gap-3 px-6 py-3 hover:bg-muted/60 focus-visible:bg-muted/60"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{b.customer.fullName}</span>
                            {b.priority !== 'STANDARD' ? (
                              <Badge variant={PRIORITY_VARIANT[b.priority]}>
                                {b.priority === 'EMERGENCY' ? 'Emergency' : 'Priority'}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="truncate text-sm text-muted-foreground">
                            {formatWhen(b.scheduledAt)} · {b.city.name} · {b.code}
                          </p>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </ListState>
            </CardContent>
          </Card>
        ) : null}

        {canDispatch ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent dispatch decisions</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              <ListState
                loading={decisions.isLoading}
                error={decisions.isError}
                empty={(decisions.data ?? []).length === 0}
                emptyText="No assignments yet today."
              >
                <ul className="divide-y">
                  {(decisions.data ?? []).slice(0, 6).map((d) => (
                    <li key={d.id}>
                      <Link
                        href={`/bookings/${d.bookingId}`}
                        className="flex items-center gap-3 px-6 py-3 hover:bg-muted/60 focus-visible:bg-muted/60"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{d.technician?.fullName ?? 'Technician'}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {DECISION_LABEL[d.decision] ?? d.decision}
                            {d.etaMin != null ? ` · ETA ${d.etaMin} min` : ''}
                            {d.distanceKm != null ? ` · ${d.distanceKm.toFixed(1)} km` : ''}
                          </p>
                        </div>
                        <time className="shrink-0 text-xs tabular-nums text-muted-foreground" dateTime={d.createdAt}>
                          {formatWhen(d.createdAt)}
                        </time>
                      </Link>
                    </li>
                  ))}
                </ul>
              </ListState>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function Metric({
  href,
  label,
  value,
  hint,
  icon: Icon,
  loading,
  error,
  tone,
}: {
  href: string;
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  loading: boolean;
  error: boolean;
  tone?: 'danger';
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
    >
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : error ? (
        <p className="mt-2 text-sm text-danger-700">Couldn&apos;t load</p>
      ) : (
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === 'danger' ? 'text-danger-700 dark:text-danger-500' : ''}`}>
          {value}
        </p>
      )}
      {hint && !loading && !error ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p> : null}
    </Link>
  );
}

function ListState({
  loading,
  error,
  empty,
  emptyText,
  children,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="space-y-3 px-6 py-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (error) return <p className="px-6 py-4 text-sm text-danger-700">Couldn&apos;t load this list. Refresh to try again.</p>;
  if (empty) return <p className="px-6 py-4 text-sm text-muted-foreground">{emptyText}</p>;
  return <>{children}</>;
}

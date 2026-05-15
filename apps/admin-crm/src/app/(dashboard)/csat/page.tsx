'use client';

import * as React from 'react';
import { Star, ThumbsUp, ThumbsDown } from 'lucide-react';

import { Skeleton } from '@ac/ui';

import { useAgentProductivity, useSupportOverview } from '@/hooks/use-support';

const DAY_MS = 86_400_000;

export default function CsatPage() {
  const range = React.useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * DAY_MS);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);
  const overview = useSupportOverview(range);
  const productivity = useAgentProductivity(range);
  const o = overview.data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Star className="size-5" />
          Customer satisfaction
        </h1>
        <p className="text-sm text-muted-foreground">
          CSAT, agent productivity and resolution outcomes over the last 30 days.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card label="Average rating" loading={overview.isLoading}>
          {o?.csat.count ? `${o.csat.averageRating.toFixed(2)} / 5` : '—'}
          <div className="mt-1 text-xs text-muted-foreground">
            {o?.csat.count ?? 0} ratings collected
          </div>
        </Card>
        <Card label="Promoters" loading={overview.isLoading} tone="positive">
          <span className="flex items-center gap-2">
            <ThumbsUp className="size-5 text-emerald-600" />
            {o?.csat.promoters ?? 0}
          </span>
        </Card>
        <Card label="Detractors" loading={overview.isLoading} tone="negative">
          <span className="flex items-center gap-2">
            <ThumbsDown className="size-5 text-destructive" />
            {o?.csat.detractors ?? 0}
          </span>
        </Card>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Agent productivity
        </h2>
        {productivity.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !productivity.data || productivity.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agent activity in this range.</p>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Agent</th>
                  <th className="px-3 py-2 text-right">Handled</th>
                  <th className="px-3 py-2 text-right">Resolved</th>
                  <th className="px-3 py-2 text-right">Avg resolution</th>
                </tr>
              </thead>
              <tbody>
                {productivity.data.map((row) => (
                  <tr key={row.agentId} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{row.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.handled}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.resolved}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {Math.round(row.avgResolutionSeconds / 60)}m
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Card({
  label,
  loading,
  tone,
  children,
}: {
  label: string;
  loading?: boolean;
  tone?: 'positive' | 'negative';
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <div
          className={`mt-1 text-2xl font-semibold tabular-nums ${
            tone === 'positive' ? 'text-emerald-700' : tone === 'negative' ? 'text-destructive' : ''
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

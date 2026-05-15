'use client';

import { CheckCircle2, Clock, MapPin, Star } from 'lucide-react';

import { Badge, Button, Card, Skeleton } from '@ac/ui';

import { useDispatchRecommendations, useManualAssign } from '@/hooks/use-dispatch';

interface RecommendationsPanelProps {
  bookingId: string | null;
}

export function RecommendationsPanel({ bookingId }: RecommendationsPanelProps) {
  const recs = useDispatchRecommendations(bookingId);
  const manual = useManualAssign();

  if (!bookingId) {
    return (
      <Card className="grid h-full place-items-center p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Select a booking from the queue to see ranked dispatch recommendations.
        </p>
      </Card>
    );
  }

  if (recs.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!recs.data || recs.data.length === 0) {
    return (
      <Card className="grid h-full place-items-center p-6 text-center">
        <p className="text-sm font-semibold text-amber-700">No candidates available</p>
        <p className="text-xs text-muted-foreground">
          Try widening the search or reassign from a neighbouring zone.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {recs.data.map((r, i) => (
        <Card key={r.technicianId} className="p-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="font-semibold">{r.fullName}</span>
                <Badge variant="outline">{r.status}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3" /> {r.rating.toFixed(1)}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {r.distanceKm != null ? `${r.distanceKm.toFixed(1)} km` : '—'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {r.trafficEtaMin
                    ? `${Math.round(r.trafficEtaMin)} min (traffic)`
                    : r.etaMin
                      ? `${Math.round(r.etaMin)} min`
                      : '—'}
                </span>
                <span>{r.activeJobs} active</span>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() =>
                manual.mutate({
                  bookingId,
                  technicianId: r.technicianId,
                  reason: `Dispatcher selected #${i + 1} recommendation`,
                })
              }
              disabled={manual.isPending}
            >
              <CheckCircle2 className="mr-1 h-3 w-3" /> Assign
            </Button>
          </div>
          <ScoreBar
            score={r.score}
            breakdown={r.breakdown}
          />
        </Card>
      ))}
    </div>
  );
}

function ScoreBar({
  score,
  breakdown,
}: {
  score: number;
  breakdown: { base: number; eta: number; responseTime: number; repeatCustomer: number; priorityBoost: number };
}) {
  const total = score || 1;
  const slices = [
    { color: 'bg-emerald-500', value: breakdown.base, label: 'Base' },
    { color: 'bg-blue-500', value: breakdown.eta, label: 'ETA' },
    { color: 'bg-amber-500', value: breakdown.responseTime, label: 'Resp.' },
    { color: 'bg-purple-500', value: breakdown.repeatCustomer, label: 'Repeat' },
    { color: 'bg-rose-500', value: breakdown.priorityBoost, label: 'Pri.' },
  ];
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Score</span>
        <span className="font-mono">{score.toFixed(0)}</span>
      </div>
      <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-muted">
        {slices.map((s) => (
          <div
            key={s.label}
            className={`${s.color} h-full transition-all`}
            style={{ width: `${(s.value / total) * 100}%` }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>
    </div>
  );
}

'use client';

import { CircleDot, PauseCircle, PowerOff, ShieldAlert, Users } from 'lucide-react';

import { Card } from '@ac/ui';

import { useAvailability } from '@/hooks/use-tracking';

export function AvailabilityCard({ cityId }: { cityId: string | null }) {
  const { data } = useAvailability(cityId);
  const buckets = data?.buckets ?? {
    available: 0,
    engaged: 0,
    onBreak: 0,
    offline: 0,
    unreachable: 0,
  };
  const total =
    buckets.available + buckets.engaged + buckets.onBreak + buckets.offline + buckets.unreachable;
  const utilisation = total === 0 ? 0 : Math.round((buckets.engaged / total) * 100);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div>
        <p className="text-xs text-muted-foreground">Technician availability</p>
        <p className="flex items-baseline gap-2 text-2xl font-bold tabular-nums">
          {buckets.available}
          <span className="text-sm font-medium text-muted-foreground">/ {total} online</span>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Row label="Available" value={buckets.available} icon={CircleDot} color="text-emerald-600" />
        <Row label="Engaged" value={buckets.engaged} icon={Users} color="text-amber-600" />
        <Row label="On break" value={buckets.onBreak} icon={PauseCircle} color="text-zinc-500" />
        <Row label="Offline" value={buckets.offline} icon={PowerOff} color="text-zinc-400" />
        <Row label="Unreachable" value={buckets.unreachable} icon={ShieldAlert} color="text-red-600" />
      </div>
      <div className="rounded-md bg-muted/40 p-2">
        <p className="text-xs text-muted-foreground">Utilisation</p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-amber-500 transition-all"
            style={{ width: `${utilisation}%` }}
          />
        </div>
        <p className="mt-1 text-right text-xs font-medium tabular-nums">{utilisation}%</p>
      </div>
    </Card>
  );
}

function Row({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border px-2 py-1.5">
      <span className="flex items-center gap-1.5">
        <Icon className={`h-3 w-3 ${color}`} />
        {label}
      </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

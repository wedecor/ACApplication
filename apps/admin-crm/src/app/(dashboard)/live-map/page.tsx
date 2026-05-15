'use client';

import { Battery, Clock, Maximize2, Star, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge, Button, Card } from '@ac/ui';

import { LiveMap } from '@/components/dispatch/live-map';
import { STATUS_COLOR } from '@/components/dispatch/status-colors';
import { useUnassignedQueue } from '@/hooks/use-dispatch';
import { useRealtime } from '@/hooks/use-realtime';
import { useAvailability, useLiveMap } from '@/hooks/use-tracking';
import { type LiveTechnicianSnapshot, type TechnicianStatus } from '@/lib/api/tracking';

const STATUS_FILTERS: TechnicianStatus[] = [
  'AVAILABLE',
  'ONLINE',
  'EN_ROUTE',
  'WORKING',
  'ON_BREAK',
  'UNREACHABLE',
  'OFFLINE',
];

export default function LiveMapPage() {
  useRealtime({ rooms: ['dispatch:global'] });
  const [selectedStatus, setSelectedStatus] = useState<TechnicianStatus[]>([
    'AVAILABLE',
    'ONLINE',
    'EN_ROUTE',
    'WORKING',
  ]);
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const { data: technicians = [] } = useLiveMap({ status: selectedStatus });
  const { data: unassigned = [] } = useUnassignedQueue(null);
  const { data: availability } = useAvailability(null);

  const bookingMarkers = useMemo(
    () =>
      unassigned
        .filter((b) => b.geoLatitude != null && b.geoLongitude != null)
        .map((b) => ({
          id: b.id,
          code: b.code,
          latitude: b.geoLatitude as number,
          longitude: b.geoLongitude as number,
          priority: b.priority,
        })),
    [unassigned],
  );

  const selected = technicians.find((t) => t.technicianId === selectedTech) ?? null;

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-50 flex flex-col gap-3 bg-background p-3'
          : 'flex h-[calc(100vh-8rem)] flex-col gap-3'
      }
    >
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Live Map</h1>
          <p className="text-sm text-muted-foreground">
            Real-time technician positions, active jobs and unassigned bookings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <KpiPill icon={Users} label="Live techs" value={technicians.length} />
          <KpiPill icon={Clock} label="Unassigned" value={unassigned.length} accent />
          <Button variant="outline" size="sm" onClick={() => setFullscreen((v) => !v)}>
            <Maximize2 className="mr-1 h-4 w-4" />
            {fullscreen ? 'Exit' : 'Fullscreen'}
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((s) => {
          const palette = STATUS_COLOR[s];
          const active = selectedStatus.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() =>
                setSelectedStatus((prev) =>
                  prev.includes(s) ? prev.filter((p) => p !== s) : [...prev, s],
                )
              }
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                active
                  ? 'border-foreground/30 bg-foreground/5'
                  : 'border-border bg-muted/30 text-muted-foreground'
              }`}
            >
              <span className="block h-2 w-2 rounded-full" style={{ background: palette.fg }} />
              {palette.label}
              <span className="ml-1 text-muted-foreground tabular-nums">
                {availability?.buckets &&
                  ({
                    AVAILABLE: availability.buckets.available,
                    ONLINE: availability.buckets.available,
                    ON_BREAK: availability.buckets.onBreak,
                    OFFLINE: availability.buckets.offline,
                    UNREACHABLE: availability.buckets.unreachable,
                  } as Record<string, number>)[s]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 gap-3 overflow-hidden">
        <LiveMap
          className="flex-1"
          technicians={technicians}
          bookings={bookingMarkers}
          selectedTechnicianId={selectedTech}
          onSelectTechnician={setSelectedTech}
        />

        {selected ? (
          <TechnicianDetailsPanel technician={selected} onClose={() => setSelectedTech(null)} />
        ) : (
          <UnassignedListPanel bookings={unassigned} />
        )}
      </div>
    </div>
  );
}

function KpiPill({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
        accent ? 'border-amber-200 bg-amber-50 text-amber-900' : 'bg-background'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function TechnicianDetailsPanel({
  technician,
  onClose,
}: {
  technician: LiveTechnicianSnapshot;
  onClose(): void;
}) {
  const palette = STATUS_COLOR[technician.status];
  return (
    <Card className="flex w-80 flex-col gap-3 p-4">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Technician</p>
          <h2 className="text-lg font-semibold">{technician.fullName}</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </header>
      <Badge
        style={{ background: palette.bg, color: palette.fg, border: 'none' }}
        className="self-start"
      >
        {palette.label}
      </Badge>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Stat label="Active jobs" value={technician.activeJobs} />
        <Stat label="Rating" value={technician.rating.toFixed(1)} icon={Star} />
        <Stat
          label="Battery"
          value={technician.batteryPct != null ? `${technician.batteryPct}%` : '—'}
          icon={Battery}
        />
        <Stat
          label="Last ping"
          value={formatAgo(technician.lastLocationAt)}
          icon={Clock}
        />
      </div>
      {technician.activeBookingCode ? (
        <div className="rounded-md bg-muted p-3 text-sm">
          <p className="text-xs text-muted-foreground">Active job</p>
          <p className="font-medium">{technician.activeBookingCode}</p>
        </div>
      ) : null}
    </Card>
  );
}

function UnassignedListPanel({
  bookings,
}: {
  bookings: Array<{ id: string; code: string; priority: string; scheduledAt: string; customer: { fullName: string } }>;
}) {
  return (
    <Card className="flex w-80 flex-col gap-2 p-4">
      <h2 className="text-sm font-semibold">Unassigned queue</h2>
      <p className="text-xs text-muted-foreground">
        Click a booking to open dispatch recommendations.
      </p>
      <div className="-mx-2 mt-1 flex flex-col gap-1 overflow-y-auto">
        {bookings.length === 0 ? (
          <p className="rounded-md bg-muted/40 px-2 py-3 text-center text-xs text-muted-foreground">
            All clear — no unassigned bookings.
          </p>
        ) : (
          bookings.map((b) => (
            <a
              key={b.id}
              href={`/dispatch?bookingId=${b.id}`}
              className="rounded-md px-2 py-2 transition hover:bg-muted"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{b.code}</span>
                <Badge
                  variant={
                    b.priority === 'EMERGENCY'
                      ? 'destructive'
                      : b.priority === 'PRIORITY'
                        ? 'default'
                        : 'secondary'
                  }
                >
                  {b.priority}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {b.customer.fullName} • {new Date(b.scheduledAt).toLocaleString()}
              </p>
            </a>
          ))
        )}
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-md border p-2">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {label}
      </p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function formatAgo(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - Date.parse(iso);
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  return `${Math.round(ms / 3_600_000)}h ago`;
}

'use client';

import { Battery, Clock, Maximize2, Star, Users, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Badge, Button, Card } from '@ac/ui';

import { LiveMap } from '@/components/dispatch/live-map';
import { STATUS_COLOR } from '@/components/dispatch/status-colors';
import { useUnassignedQueue } from '@/hooks/use-dispatch';
import { useRealtime } from '@/hooks/use-realtime';
import { useAvailability, useLiveMap } from '@/hooks/use-tracking';
import { type LiveTechnicianSnapshot, type TechnicianStatus } from '@/lib/api/tracking';
import { formatWhen } from '@/lib/format';

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
          ? 'fixed inset-0 z-50 flex flex-col gap-3 overflow-y-auto bg-background p-3'
          : 'flex flex-col gap-3 lg:h-[calc(100vh-8rem)]'
      }
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Live map</h1>
          <p className="text-sm text-muted-foreground">
            Where technicians are right now, and bookings still waiting for one.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <KpiPill icon={Users} label="Live techs" value={technicians.length} />
          <KpiPill icon={Clock} label="Unassigned" value={unassigned.length} accent />
          <Button variant="outline" size="sm" onClick={() => setFullscreen((v) => !v)} aria-pressed={fullscreen}>
            <Maximize2 aria-hidden />
            {fullscreen ? 'Exit full screen' : 'Full screen'}
          </Button>
        </div>
      </header>

      <div
        role="group"
        aria-label="Filter technicians by status"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {STATUS_FILTERS.map((s) => {
          const palette = STATUS_COLOR[s];
          const active = selectedStatus.includes(s);
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() =>
                setSelectedStatus((prev) =>
                  prev.includes(s) ? prev.filter((p) => p !== s) : [...prev, s],
                )
              }
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${
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

      <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:overflow-hidden">
        <LiveMap
          className="h-[55vh] min-h-[320px] lg:h-auto lg:flex-1"
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
        accent ? 'border-warning-500/30 bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-500' : 'bg-background'
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
    <Card className="flex w-full flex-col gap-3 p-4 lg:w-80">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Technician</p>
          <h2 className="text-lg font-semibold">{technician.fullName}</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close technician details" className="-mr-2 -mt-2">
          <X aria-hidden />
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
    <Card className="flex w-full flex-col gap-2 p-4 lg:w-80">
      <h2 className="text-sm font-semibold">Unassigned queue</h2>
      <p className="text-sm text-muted-foreground">Tap a booking to see ranked technicians.</p>
      <div className="-mx-2 mt-1 flex flex-col gap-1 overflow-y-auto">
        {bookings.length === 0 ? (
          <p className="rounded-md bg-muted/40 px-2 py-3 text-center text-xs text-muted-foreground">
            All clear — no unassigned bookings.
          </p>
        ) : (
          bookings.map((b) => (
            <Link
              key={b.id}
              href={`/dispatch?bookingId=${b.id}`}
              className="rounded-md px-2 py-2 transition-colors hover:bg-muted"
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium">{b.customer.fullName}</span>
                {b.priority === 'EMERGENCY' ? (
                  <Badge variant="destructive">Emergency</Badge>
                ) : b.priority === 'PRIORITY' ? (
                  <Badge variant="warning">Priority</Badge>
                ) : null}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {formatWhen(b.scheduledAt)} · {b.code}
              </p>
            </Link>
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

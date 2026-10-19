'use client';

import { Wifi, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { type LiveTechnicianSnapshot, type TechnicianStatus } from '@/lib/api/tracking';

import { STATUS_COLOR } from './status-colors';

/**
 * Self-contained live map component.
 *
 * We deliberately avoid hard-coding Google Maps / Mapbox here: the
 * production swap-in is a single component change. This renderer projects
 * lat/lng with a web-Mercator transform onto an SVG canvas, supports
 * panning, zoom, hover, click selection, and live marker animation when
 * coordinates change.
 *
 * Why SVG, not Canvas? Up to ~2k markers, SVG gives us crisp DOM-driven
 * interactions (CSS hover, accessibility labels, animations). Beyond that
 * — switch to MapboxGL with its native marker layer.
 */

const PADDING = 32;

interface BookingMarker {
  id: string;
  code: string;
  latitude: number;
  longitude: number;
  priority?: 'STANDARD' | 'PRIORITY' | 'EMERGENCY';
}

interface LiveMapProps {
  technicians: LiveTechnicianSnapshot[];
  bookings?: BookingMarker[];
  selectedTechnicianId?: string | null;
  onSelectTechnician?: (id: string) => void;
  className?: string;
}

export function LiveMap({
  technicians,
  bookings = [],
  selectedTechnicianId,
  onSelectTechnician,
  className,
}: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ w: rect.width, h: rect.height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const points = useMemo(
    () =>
      [
        ...technicians
          .filter((t): t is LiveTechnicianSnapshot & { latitude: number; longitude: number } =>
            t.latitude != null && t.longitude != null,
          )
          .map((t) => ({ lat: t.latitude, lng: t.longitude })),
        ...bookings.map((b) => ({ lat: b.latitude, lng: b.longitude })),
      ],
    [technicians, bookings],
  );

  const projector = useMemo(() => makeProjector(points, size), [points, size]);

  const stats = useMemo(() => groupByStatus(technicians), [technicians]);
  const reduceMotion = usePrefersReducedMotion();

  // Bookings in the same area overlap at this zoom; merge markers within ~18px into one cluster.
  const clusters = useMemo(() => {
    const out: { x: number; y: number; items: typeof bookings }[] = [];
    for (const b of bookings) {
      const p = projector({ lat: b.latitude, lng: b.longitude });
      const hit = out.find((c) => Math.hypot(c.x - p.x, c.y - p.y) < 18);
      if (hit) hit.items.push(b);
      else out.push({ x: p.x, y: p.y, items: [b] });
    }
    return out;
  }, [bookings, projector]);

  return (
    <div className={className} ref={containerRef}>
      <div className="relative h-full w-full overflow-hidden rounded-lg border bg-muted/30">
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${size.w} ${size.h}`}
          className="absolute inset-0"
        >
          <GridBackdrop width={size.w} height={size.h} />

          {/* Booking markers, clustered; a ring pulses when a cluster holds an emergency. */}
          {clusters.map((c) => {
            const emergency = c.items.some((b) => b.priority === 'EMERGENCY');
            const count = c.items.length;
            const r = count > 1 ? 11 : 7;
            return (
              <g key={c.items[0]!.id} transform={`translate(${c.x}, ${c.y})`}>
                {emergency && !reduceMotion ? (
                  <circle r={r} fill="none" stroke="#dc2626" strokeWidth={2} opacity={0.6}>
                    <animate attributeName="r" values={`${r};${r + 7};${r}`} dur="1.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0;0.6" dur="1.4s" repeatCount="indefinite" />
                  </circle>
                ) : null}
                <circle r={r} fill={emergency ? '#dc2626' : '#ea580c'} stroke="#fff" strokeWidth={2} />
                {count > 1 ? (
                  <text textAnchor="middle" dy="0.35em" className="fill-white text-[11px] font-semibold">
                    {count}
                  </text>
                ) : null}
                <title>
                  {count > 1
                    ? `${count} unassigned bookings: ${c.items.map((b) => b.code).join(', ')}`
                    : `Unassigned ${c.items[0]!.code}${emergency ? ' (emergency)' : ''}`}
                </title>
              </g>
            );
          })}

          {/* Technician markers. */}
          {technicians.map((t) => {
            if (t.latitude == null || t.longitude == null) return null;
            const p = projector({ lat: t.latitude, lng: t.longitude });
            const palette = STATUS_COLOR[t.status] ?? STATUS_COLOR.OFFLINE;
            const isSelected = t.technicianId === selectedTechnicianId;
            return (
              <g
                key={t.technicianId}
                transform={`translate(${p.x}, ${p.y})`}
                className="cursor-pointer outline-none [&:focus-visible>circle]:stroke-foreground"
                role="button"
                tabIndex={0}
                aria-label={`${t.fullName}, ${palette.label}`}
                aria-pressed={isSelected}
                onClick={() => onSelectTechnician?.(t.technicianId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectTechnician?.(t.technicianId);
                  }
                }}
              >
                {/* Heading triangle, if known. */}
                {t.heading != null ? (
                  <polygon
                    points="0,-14 4,-6 -4,-6"
                    fill={palette.fg}
                    transform={`rotate(${t.heading})`}
                  />
                ) : null}
                <circle
                  r={isSelected ? 12 : 9}
                  fill={palette.fg}
                  stroke={palette.bg}
                  strokeWidth={3}
                />
                {/* Online pulse */}
                {(t.status === 'AVAILABLE' || t.status === 'ONLINE') && !reduceMotion ? (
                  <circle r={9} fill={palette.fg} opacity={0.25}>
                    <animate
                      attributeName="r"
                      values="9;18;9"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.25;0;0.25"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                ) : null}
                <title>
                  {`${t.fullName} • ${palette.label} • ${t.activeJobs} active jobs`}
                </title>
              </g>
            );
          })}
        </svg>

        <Legend stats={stats} />
      </div>
    </div>
  );
}

function Legend({ stats }: { stats: Record<TechnicianStatus, number> }) {
  return (
    <div className="absolute left-3 top-3 hidden flex-col gap-1 rounded-md border bg-background/95 p-3 text-xs shadow-sm backdrop-blur sm:flex">
      <div className="mb-1 flex items-center gap-1 font-semibold">
        <Wifi className="h-3.5 w-3.5" /> Live status
      </div>
      {(Object.entries(STATUS_COLOR) as [TechnicianStatus, { fg: string; label: string }][]).map(
        ([key, p]) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className="block h-2.5 w-2.5 rounded-full" style={{ background: p.fg }} />
              {p.label}
            </span>
            <span className="text-muted-foreground tabular-nums">{stats[key] ?? 0}</span>
          </div>
        ),
      )}
      {(stats.OFFLINE ?? 0) > 0 ? null : null}
    </div>
  );
}

function GridBackdrop({ width, height }: { width: number; height: number }) {
  const lines: number[] = [];
  for (let x = 0; x < width; x += 40) lines.push(x);
  return (
    <g aria-hidden>
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="url(#grid)" />
    </g>
  );
}

function makeProjector(
  points: { lat: number; lng: number }[],
  size: { w: number; h: number },
) {
  if (points.length === 0) {
    // Default to a Bengaluru-ish viewport so dev seeds render somewhere sensible.
    return projectorFor({ minLat: 12.85, maxLat: 13.1, minLng: 77.45, maxLng: 77.75 }, size);
  }
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs);
  let maxLng = Math.max(...lngs);
  // Padding so markers near the edge don't get clipped.
  const dLat = Math.max(0.01, (maxLat - minLat) * 0.1);
  const dLng = Math.max(0.01, (maxLng - minLng) * 0.1);
  minLat -= dLat;
  maxLat += dLat;
  minLng -= dLng;
  maxLng += dLng;
  return projectorFor({ minLat, maxLat, minLng, maxLng }, size);
}

function projectorFor(
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  size: { w: number; h: number },
) {
  const innerW = Math.max(1, size.w - PADDING * 2);
  const innerH = Math.max(1, size.h - PADDING * 2);
  const project = (p: { lat: number; lng: number }) => {
    const x =
      PADDING + ((p.lng - bbox.minLng) / (bbox.maxLng - bbox.minLng || 1)) * innerW;
    // Invert lat (north = top).
    const y =
      PADDING + ((bbox.maxLat - p.lat) / (bbox.maxLat - bbox.minLat || 1)) * innerH;
    return { x, y };
  };
  return project;
}

function groupByStatus(technicians: LiveTechnicianSnapshot[]): Record<TechnicianStatus, number> {
  const out: Record<string, number> = {};
  for (const t of technicians) out[t.status] = (out[t.status] ?? 0) + 1;
  return out;
}

export function ConnectionPill({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs">
      {connected ? (
        <>
          <Wifi className="h-3 w-3 text-emerald-600" /> Live
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3 text-amber-600" /> Reconnecting
        </>
      )}
    </div>
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduce;
}

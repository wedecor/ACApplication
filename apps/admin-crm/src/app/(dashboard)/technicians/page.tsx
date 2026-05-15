'use client';

import Link from 'next/link';
import { Map, Star, Wrench } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ac/ui';

import { LoadError } from '@/components/common/load-error';
import { STATUS_COLOR } from '@/components/dispatch/status-colors';
import { useAvailability } from '@/hooks/use-tracking';
import type { TechnicianStatus } from '@/lib/api/tracking';
import { formatDateTime } from '@/lib/format';

export default function TechniciansPage() {
  const { data, isLoading, error } = useAvailability(null);
  const technicians = data?.technicians ?? [];
  const buckets = data?.buckets;

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Wrench className="size-5" />
            Technicians
          </h1>
          <p className="text-sm text-muted-foreground">
            Field team availability and performance — open the live map for GPS tracking.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/live-map">
            <Map className="size-4" />
            Live map
          </Link>
        </Button>
      </header>

      {buckets ? (
        <div className="grid gap-3 sm:grid-cols-5">
          <Bucket label="Available" value={buckets.available} />
          <Bucket label="Engaged" value={buckets.engaged} />
          <Bucket label="On break" value={buckets.onBreak} />
          <Bucket label="Offline" value={buckets.offline} />
          <Bucket label="Unreachable" value={buckets.unreachable} />
        </div>
      ) : null}

      {error ? <LoadError label="technicians" message={(error as Error).message} /> : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                <TableHead className="text-right">Acceptance</TableHead>
                <TableHead className="text-right">Active jobs</TableHead>
                <TableHead>Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : technicians.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState
                      icon={Wrench}
                      title="No technicians"
                      description="Seed technician users or check tracking permissions."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                technicians.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.fullName}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: STATUS_COLOR[t.status as TechnicianStatus].fg,
                          color: STATUS_COLOR[t.status as TechnicianStatus].fg,
                          backgroundColor: STATUS_COLOR[t.status as TechnicianStatus].bg,
                        }}
                      >
                        {t.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center justify-end gap-1 tabular-nums">
                        <Star className="size-3 fill-amber-400 text-amber-400" />
                        {t.rating.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Math.round(t.acceptanceRate * 100)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{t._count.bookings}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.lastSeenAt ? formatDateTime(t.lastSeenAt) : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

function Bucket({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

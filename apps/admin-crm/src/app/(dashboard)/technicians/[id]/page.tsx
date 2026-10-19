'use client';

import { Permission } from '@ac/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ac/ui';
import { ArrowLeft, ExternalLink, Pencil, Power, Star } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { ContactButtons } from '@/components/common/contact-buttons';
import { Pagination } from '@/components/common/pagination';
import { STATUS_COLOR } from '@/components/dispatch/status-colors';
import { CommissionRuleCard } from '@/components/technicians/commission-rule-card';
import { DeactivateTechnicianDialog } from '@/components/technicians/deactivate-technician-dialog';
import { TechnicianFormModal } from '@/components/technicians/technician-form-modal';
import { useReactivateTechnician, useTechnician, useTechnicianBookings } from '@/hooks/use-technicians';
import { apiErrorMessage } from '@/lib/api/error-message';
import type { TechnicianDetail, Weekday } from '@/lib/api/technicians';
import { formatDate, formatDateTime, formatMinor } from '@/lib/format';
import { categoryLabel, humanizeEnum } from '@/lib/labels';
import { hasPermission, readSessionClaims } from '@/lib/rbac/permissions';

const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export default function TechnicianDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: t, isLoading, error } = useTechnician(id);
  const { permissions } = readSessionClaims();
  const canWrite = hasPermission(Permission.TECHNICIAN_WRITE, permissions);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deactivateOpen, setDeactivateOpen] = React.useState(false);
  const reactivate = useReactivateTechnician();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !t) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-destructive">{error ? apiErrorMessage(error) : 'Technician not found'}</p>
      </div>
    );
  }

  const suspended = t.user.status !== 'ACTIVE';
  const status = STATUS_COLOR[t.status];

  const onReactivate = async () => {
    try {
      await reactivate.mutateAsync(t.id);
      toast.success(`${t.fullName} reactivated`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to reactivate'));
    }
  };

  return (
    <div className="space-y-6">
      <BackLink />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{t.fullName}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" style={{ borderColor: status.fg, color: status.fg, backgroundColor: status.bg }}>
              {humanizeEnum(t.status)}
            </Badge>
            {suspended ? <Badge variant="destructive">Deactivated</Badge> : <Badge variant="success">Active</Badge>}
          </div>
          <div className="text-sm text-muted-foreground">
            <p>
              {t.employeeCode} · {t.city.name}, {t.city.state}
            </p>
            <p className="break-all">
              {t.phone}
              {t.user.email ? ` · ${t.user.email}` : null}
            </p>
          </div>
          <ContactButtons phone={t.phone} />
        </div>
        {canWrite ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil aria-hidden /> Edit
            </Button>
            {suspended ? (
              <Button variant="outline" disabled={reactivate.isPending} onClick={() => void onReactivate()}>
                Reactivate
              </Button>
            ) : (
              <Button
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDeactivateOpen(true)}
              >
                <Power aria-hidden /> Deactivate
              </Button>
            )}
          </div>
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Rating" value={t.stats.rating.toFixed(2)} sub={`${t.stats.ratingCount} reviews`} />
        <Stat label="Lifetime jobs" value={t.stats.totalJobs} />
        <Stat label="Completed" value={t.stats.completedJobs} />
        <Stat label="Open bookings" value={t.stats.openBookings} />
        <Stat label="Completion" value={`${Math.round(t.stats.completionRate * 100)}%`} />
        <Stat label="Acceptance" value={`${Math.round(t.stats.acceptanceRate * 100)}%`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ProfileCard t={t} />
        <WorkingHoursCard t={t} />
        <CommissionRuleCard technicianId={t.id} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <JobsCard technicianId={t.id} />
        </div>
        <RatingsCard t={t} />
      </div>

      <TechnicianFormModal open={editOpen} onOpenChange={setEditOpen} technician={t} />
      <DeactivateTechnicianDialog
        technician={deactivateOpen ? t : null}
        onOpenChange={(open) => setDeactivateOpen(open)}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
        href="/technicians"
        className="-ml-2 inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Technicians
      </Link>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card>
      <CardContent className="py-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}

function ProfileCard({ t }: { t: TechnicianDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Skills</p>
          <div className="flex flex-wrap gap-1">
            {t.skills.map((s) => (
              <Badge key={s} variant="muted">
                {categoryLabel(s)}
              </Badge>
            ))}
          </div>
        </div>
        <dl className="space-y-1 text-xs">
          <Row label="Daily capacity" value={`${t.dailyCapacity} jobs`} />
          <Row label="Last login" value={t.user.lastLoginAt ? formatDateTime(t.user.lastLoginAt) : 'Never'} />
          <Row label="Last seen" value={t.lastSeenAt ? formatDateTime(t.lastSeenAt) : '—'} />
          <Row label="Battery" value={t.lastBatteryPct !== null ? `${t.lastBatteryPct}%` : '—'} />
          <Row label="Onboarded" value={formatDate(t.createdAt)} />
        </dl>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Documents</p>
          {t.documents.length === 0 ? (
            <p className="text-xs text-muted-foreground">None on file.</p>
          ) : (
            <ul className="space-y-1">
              {t.documents.map((d, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-xs">
                  <a href={d.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 hover:underline">
                    {d.label || humanizeEnum(d.type)}
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                  {d.verified ? <Badge variant="success">Verified</Badge> : <Badge variant="outline">Unverified</Badge>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function WorkingHoursCard({ t }: { t: TechnicianDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Working hours</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-1 text-xs">
          {WEEKDAYS.map((d) => {
            const windows = t.workingHours?.[d] ?? [];
            return (
              <Row
                key={d}
                label={d.charAt(0).toUpperCase() + d.slice(1)}
                value={windows.length ? windows.map(([a, b]) => `${a}–${b}`).join(', ') : 'Off'}
              />
            );
          })}
        </dl>
      </CardContent>
    </Card>
  );
}

function JobsCard({ technicianId }: { technicianId: string }) {
  const [page, setPage] = React.useState(1);
  const { data, isLoading } = useTechnicianBookings(technicianId, page);
  const items = data?.items ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Jobs</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table stackOnMobile>
          <TableHeader>
            <TableRow>
              <TableHead>Booking</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                  No jobs yet.
                </TableCell>
              </TableRow>
            ) : (
              items.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link href={`/bookings/${b.id}`} className="font-mono text-xs hover:underline">
                      {b.code}
                    </Link>
                    <p className="text-[11px] text-muted-foreground">{b.serviceType ?? b.category.replace(/_/g, ' ')}</p>
                  </TableCell>
                  <TableCell className="text-sm">{b.customer.fullName}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(b.scheduledAt)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {humanizeEnum(b.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatMinor(b.finalAmountMinor ?? b.estimatedAmountMinor, b.currency)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {data && data.pagination.total > data.pagination.pageSize ? (
          <div className="px-4">
            <Pagination
              page={data.pagination.page}
              pageSize={data.pagination.pageSize}
              total={data.pagination.total}
              totalPages={data.pagination.totalPages}
              onPageChange={setPage}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RatingsCard({ t }: { t: TechnicianDetail }) {
  const max = Math.max(1, ...t.stats.ratingDistribution.map((d) => d.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ratings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          {[...t.stats.ratingDistribution].reverse().map((d) => (
            <div key={d.value} className="flex items-center gap-2 text-xs">
              <span className="w-6 tabular-nums">{d.value}★</span>
              <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                <div className="h-full rounded bg-amber-400" style={{ width: `${(d.count / max) * 100}%` }} />
              </div>
              <span className="w-6 text-right tabular-nums text-muted-foreground">{d.count}</span>
            </div>
          ))}
        </div>
        {t.recentRatings.length === 0 ? (
          <p className="text-xs text-muted-foreground">No ratings yet.</p>
        ) : (
          <ul className="space-y-3">
            {t.recentRatings.map((r) => (
              <li key={r.id} className="border-t pt-2 text-xs first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden />
                    {r.value} · {r.customer.fullName}
                  </span>
                  <span className="text-muted-foreground">{formatDate(r.createdAt)}</span>
                </div>
                {r.comment ? <p className="mt-1 text-muted-foreground">{r.comment}</p> : null}
                <Link href={`/bookings/${r.booking.id}`} className="font-mono text-[10px] text-muted-foreground hover:underline">
                  {r.booking.code}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}

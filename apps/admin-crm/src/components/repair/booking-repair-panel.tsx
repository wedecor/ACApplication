'use client';

import { Permission } from '@ac/types';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Separator } from '@ac/ui';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';

import {
  useAppliances,
  useCatalog,
  useCreateWarrantyClaim,
  useCreateWorkshopJob,
  useJobCardByBooking,
  useUpdateBookingRepairFields,
  useWarrantyCheck,
} from '@/hooks/use-repair';
import { type BookingRepairInfo, humanize, type ServiceMode } from '@/lib/api/repair';
import { formatDate, formatMinor } from '@/lib/format';

import {
  ClaimStatusBadge,
  errorMessage,
  Field,
  JobCardStatusBadge,
  NativeSelect,
  useCan,
  WorkshopStatusBadge,
} from './repair-ui';

const CLOSED_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'NO_SHOW']);

/**
 * Repair panels for the booking detail page: appliance / rate-card picker,
 * job card summary, warranty and workshop status. Self-contained so the
 * page only needs `<BookingRepairPanel booking={booking} />`.
 */
export function BookingRepairPanel({ booking }: { booking: unknown }) {
  const b = booking as BookingRepairInfo;
  return (
    <div className="space-y-6">
      <ApplianceCard booking={b} />
      <JobCardCard booking={b} />
      <WarrantyCard booking={b} />
      <WorkshopCard booking={b} />
    </div>
  );
}

function ApplianceCard({ booking }: { booking: BookingRepairInfo }) {
  const canEdit = useCan(Permission.BOOKING_UPDATE) && !CLOSED_STATUSES.has(booking.status);
  const canViewAppliances = useCan(Permission.APPLIANCE_VIEW);
  const [editing, setEditing] = React.useState(false);
  const [applianceId, setApplianceId] = React.useState(booking.applianceId ?? '');
  const [catalogItemId, setCatalogItemId] = React.useState(booking.catalogItemId ?? '');
  const [serviceMode, setServiceMode] = React.useState<ServiceMode>(booking.serviceMode ?? 'ON_SITE');
  const appliances = useAppliances({ customerId: booking.customerId, pageSize: 50 }, editing && canViewAppliances);
  const catalog = useCatalog(editing ? { category: booking.category, active: true } : { category: booking.category });
  const save = useUpdateBookingRepairFields(booking.id);

  React.useEffect(() => {
    setApplianceId(booking.applianceId ?? '');
    setCatalogItemId(booking.catalogItemId ?? '');
    setServiceMode(booking.serviceMode ?? 'ON_SITE');
  }, [booking.applianceId, booking.catalogItemId, booking.serviceMode]);

  const submit = () => {
    save.mutate(
      {
        applianceId: applianceId || (booking.applianceId ? null : undefined),
        catalogItemId: catalogItemId || (booking.catalogItemId ? null : undefined),
        serviceMode,
      },
      {
        onSuccess: () => {
          toast.success('Booking updated');
          setEditing(false);
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  const a = booking.appliance;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Appliance & service</CardTitle>
        {canEdit && !editing ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Change
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {editing ? (
          <div className="space-y-3">
            <Field label="Appliance" htmlFor="br-appliance">
              <NativeSelect id="br-appliance" value={applianceId} onChange={(e) => setApplianceId(e.target.value)}>
                <option value="">— Not linked —</option>
                {(appliances.data?.items ?? []).map((ap) => (
                  <option key={ap.id} value={ap.id}>
                    {ap.brand} {ap.modelNumber ?? ''} · {humanize(ap.category)}
                    {ap.serialNumber ? ` · ${ap.serialNumber}` : ''}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Service (rate card)" htmlFor="br-catalog">
              <NativeSelect id="br-catalog" value={catalogItemId} onChange={(e) => setCatalogItemId(e.target.value)}>
                <option value="">— None —</option>
                {(catalog.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {formatMinor(c.basePriceMinor + c.visitChargeMinor)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Service mode" htmlFor="br-mode" hint="Pickup/drop and carry-in create a workshop job.">
              <NativeSelect id="br-mode" value={serviceMode} onChange={(e) => setServiceMode(e.target.value as ServiceMode)}>
                <option value="ON_SITE">On site</option>
                <option value="PICKUP_DROP">Pickup & drop</option>
                <option value="CARRY_IN">Carry in</option>
              </NativeSelect>
            </Field>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={submit} disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Row label="Appliance">
              {a ? (
                <Link href={`/appliances/${a.id}`} className="text-primary hover:underline">
                  {a.brand} {a.modelNumber ?? ''}
                </Link>
              ) : (
                '—'
              )}
            </Row>
            {a?.serialNumber ? <Row label="Serial">{a.serialNumber}</Row> : null}
            <Row label="Service">{booking.catalogItem?.name ?? '—'}</Row>
            <Row label="Mode">{humanize(booking.serviceMode)}</Row>
            {booking.isWarrantyRevisit && booking.parentBooking ? (
              <Row label="Revisit of">
                <Link href={`/bookings/${booking.parentBooking.id}`} className="text-primary hover:underline">
                  {booking.parentBooking.code}
                </Link>
              </Row>
            ) : null}
            {booking.rating ? <Row label="Rating">{'★'.repeat(booking.rating.value)}</Row> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function JobCardCard({ booking }: { booking: BookingRepairInfo }) {
  const canView = useCan(Permission.JOBCARD_VIEW);
  const { data } = useJobCardByBooking(canView ? booking.id : undefined);
  if (!canView) return null;
  const jc = data?.jobCard ?? null;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Job card</CardTitle>
        {jc ? <JobCardStatusBadge status={jc.status} /> : null}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {!jc ? (
          <p className="text-xs text-muted-foreground">
            Not started — the technician fills it from the mobile app.
            {data?.templates.length ? ` ${data.templates.length} checklist(s) apply.` : ''}
          </p>
        ) : (
          <>
            <Row label="Fault codes">{jc.faultCodes.length ? jc.faultCodes.join(', ') : '—'}</Row>
            <Row label="Diagnosis">{jc.diagnosis ?? '—'}</Row>
            <Row label="Resolution">{jc.resolution ?? '—'}</Row>
            {jc.firstTimeFix != null ? <Row label="First-time fix">{jc.firstTimeFix ? 'Yes' : 'No'}</Row> : null}
            <Link href={`/job-cards/${jc.id}`} className="text-xs text-primary hover:underline">
              Open job card →
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function WarrantyCard({ booking }: { booking: BookingRepairInfo }) {
  const canView = useCan(Permission.WARRANTY_VIEW);
  const canManage = useCan(Permission.WARRANTY_MANAGE);
  const check = useWarrantyCheck({ bookingId: booking.id }, canView && booking.status === 'COMPLETED');
  const create = useCreateWarrantyClaim();
  const [reason, setReason] = React.useState('');
  if (!canView) return null;

  const raise = () => {
    if (!reason.trim()) {
      toast.error('Enter the reason for the claim');
      return;
    }
    create.mutate(
      {
        type: 'REPAIR_REVISIT',
        customerId: booking.customerId,
        originalBookingId: booking.id,
        applianceId: booking.applianceId ?? undefined,
        reason: reason.trim(),
      },
      {
        onSuccess: (claim) => {
          toast.success(`Claim ${claim.number} raised`);
          setReason('');
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Warranty</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Row label="Repair warranty">
          {booking.repairWarrantyUntil
            ? `${booking.warranty?.repairWarrantyActive ? 'Until' : 'Expired'} ${formatDate(booking.repairWarrantyUntil)}`
            : 'Starts on completion'}
        </Row>
        {booking.appliance ? (
          <Row label="Manufacturer">{booking.warranty?.manufacturerWarrantyActive ? 'Active' : 'Not active'}</Row>
        ) : null}
        {booking.warrantyClaimRevisit ? (
          <Row label="Revisit claim">
            <Link href={`/warranty/${booking.warrantyClaimRevisit.id}`} className="text-primary hover:underline">
              {booking.warrantyClaimRevisit.number}
            </Link>
          </Row>
        ) : null}
        {booking.warrantyClaimsOriginal?.length ? (
          <>
            <Separator />
            <ul className="space-y-1">
              {booking.warrantyClaimsOriginal.map((c) => (
                <li key={c.id} className="flex items-center justify-between">
                  <Link href={`/warranty/${c.id}`} className="text-primary hover:underline">
                    {c.number}
                  </Link>
                  <ClaimStatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {canManage && check.data?.eligibleForRepairRevisit ? (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs text-muted-foreground">Eligible for a free repair revisit.</p>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What failed again?" />
            <Button size="sm" onClick={raise} disabled={create.isPending}>
              Raise revisit claim
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function WorkshopCard({ booking }: { booking: BookingRepairInfo }) {
  const canView = useCan(Permission.WORKSHOP_VIEW);
  const canManage = useCan(Permission.WORKSHOP_MANAGE);
  const create = useCreateWorkshopJob();
  if (!canView) return null;
  const job = booking.workshopJob;
  if (!job && (booking.serviceMode === 'ON_SITE' && !canManage)) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Workshop</CardTitle>
        {job ? <WorkshopStatusBadge status={job.status} /> : null}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {job ? (
          <>
            <Row label="Job">{job.number}</Row>
            {job.pickupScheduledAt ? <Row label="Pickup">{formatDate(job.pickupScheduledAt)}</Row> : null}
            {job.estimatedReadyAt ? <Row label="ETA">{formatDate(job.estimatedReadyAt)}</Row> : null}
            <Link href={`/workshop?focus=${job.id}`} className="text-xs text-primary hover:underline">
              Open workshop board →
            </Link>
          </>
        ) : canManage && !CLOSED_STATUSES.has(booking.status) ? (
          <Button
            size="sm"
            variant="outline"
            disabled={create.isPending}
            onClick={() =>
              create.mutate(
                { bookingId: booking.id },
                {
                  onSuccess: () => toast.success('Moved to workshop'),
                  onError: (err) => toast.error(errorMessage(err)),
                },
              )
            }
          >
            Move to workshop (pickup)
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">No workshop job.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

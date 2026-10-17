'use client';

import { Permission } from '@ac/types';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Skeleton } from '@ac/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import {
  ClaimStatusBadge,
  errorMessage,
  Field,
  localToIso,
  Textarea,
  useCan,
} from '@/components/repair/repair-ui';
import { useDecideClaim, useScheduleRevisit, useUpdateOem, useWarrantyClaim } from '@/hooks/use-repair';
import { humanize, type WarrantyClaim } from '@/lib/api/repair';
import { formatDate, formatDateTime, formatMinor } from '@/lib/format';

export default function WarrantyClaimPage() {
  const { id } = useParams<{ id: string }>();
  const canManage = useCan(Permission.WARRANTY_MANAGE);
  const { data: claim, isLoading, error } = useWarrantyClaim(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (error || !claim) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-destructive">{error ? errorMessage(error) : 'Claim not found'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink />
      <header>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{claim.number}</h1>
          <ClaimStatusBadge status={claim.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {humanize(claim.type)} · raised {formatDateTime(claim.createdAt)}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Claim</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Kv label="Reason">{claim.reason}</Kv>
              {claim.description ? <p className="text-muted-foreground">{claim.description}</p> : null}
              <Kv label="Customer">
                {claim.customer ? (
                  <Link href={`/customers/${claim.customer.id}`} className="text-primary hover:underline">
                    {claim.customer.fullName}
                  </Link>
                ) : (
                  '—'
                )}
              </Kv>
              <Kv label="Appliance">
                {claim.appliance ? (
                  <Link href={`/appliances/${claim.appliance.id}`} className="text-primary hover:underline">
                    {claim.appliance.brand} {claim.appliance.modelNumber ?? ''}
                  </Link>
                ) : (
                  '—'
                )}
              </Kv>
              <Kv label="Original job">
                {claim.originalBooking ? (
                  <Link href={`/bookings/${claim.originalBooking.id}`} className="text-primary hover:underline">
                    {claim.originalBooking.code}
                  </Link>
                ) : (
                  '—'
                )}
              </Kv>
              {claim.originalBooking?.repairWarrantyUntil ? (
                <Kv label="Repair warranty until">{formatDate(claim.originalBooking.repairWarrantyUntil)}</Kv>
              ) : null}
              {claim.revisitBooking ? (
                <Kv label="Revisit booking">
                  <Link href={`/bookings/${claim.revisitBooking.id}`} className="text-primary hover:underline">
                    {claim.revisitBooking.code}
                  </Link>{' '}
                  · {formatDateTime(claim.revisitBooking.scheduledAt)} · {humanize(claim.revisitBooking.status)}
                </Kv>
              ) : null}
              {claim.type === 'OEM_CLAIM' ? (
                <>
                  <Kv label="OEM">{claim.oemName ?? '—'}</Kv>
                  <Kv label="OEM reference">{claim.oemClaimRef ?? '—'}</Kv>
                  <Kv label="Claimed">{formatMinor(claim.claimAmountMinor)}</Kv>
                  <Kv label="Settled">{formatMinor(claim.settledAmountMinor)}</Kv>
                </>
              ) : null}
              {claim.decidedAt ? (
                <Kv label="Decision">
                  {formatDateTime(claim.decidedAt)}
                  {claim.decisionNotes ? ` — ${claim.decisionNotes}` : ''}
                </Kv>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          {canManage ? <ClaimActions claim={claim} /> : null}
        </aside>
      </div>
    </div>
  );
}

function ClaimActions({ claim }: { claim: WarrantyClaim }) {
  const decide = useDecideClaim(claim.id);
  const revisit = useScheduleRevisit(claim.id);
  const oem = useUpdateOem(claim.id);
  const [notes, setNotes] = React.useState('');
  const [when, setWhen] = React.useState('');
  const [slot, setSlot] = React.useState('');
  const [oemRef, setOemRef] = React.useState(claim.oemClaimRef ?? '');
  const [settled, setSettled] = React.useState('');

  const handlers = (msg: string) => ({
    onSuccess: () => toast.success(msg),
    onError: (err: unknown) => toast.error(errorMessage(err)),
  });

  if (claim.status === 'OPEN') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Decide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Notes" htmlFor="wc-notes">
            <Textarea id="wc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </Field>
          <div className="flex gap-2">
            <Button
              disabled={decide.isPending}
              onClick={() => decide.mutate({ approve: true, notes: notes || undefined }, handlers('Claim approved'))}
            >
              Approve
            </Button>
            <Button
              variant="destructive"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ approve: false, notes: notes || undefined }, handlers('Claim rejected'))}
            >
              Reject
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (claim.type === 'REPAIR_REVISIT' && claim.status === 'APPROVED' && !claim.revisitBookingId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Schedule free revisit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="When" htmlFor="wc-when">
            <Input id="wc-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
          <Field label="Time slot" htmlFor="wc-slot">
            <Input id="wc-slot" value={slot} onChange={(e) => setSlot(e.target.value)} placeholder="10:00-12:00" />
          </Field>
          <Button
            disabled={revisit.isPending || !when}
            onClick={() => {
              const scheduledAt = localToIso(when);
              if (!scheduledAt) return;
              revisit.mutate(
                { scheduledAt, scheduledTimeSlot: slot || undefined },
                handlers('Revisit booking created'),
              );
            }}
          >
            Create zero-charge booking
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (claim.type === 'OEM_CLAIM' && claim.status === 'APPROVED') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submit to OEM</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="OEM claim reference" htmlFor="wc-ref">
            <Input id="wc-ref" value={oemRef} onChange={(e) => setOemRef(e.target.value)} />
          </Field>
          <Button
            disabled={oem.isPending || !oemRef.trim()}
            onClick={() => oem.mutate({ status: 'SUBMITTED_TO_OEM', oemClaimRef: oemRef.trim() }, handlers('Submitted to OEM'))}
          >
            Mark submitted
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (claim.type === 'OEM_CLAIM' && claim.status === 'SUBMITTED_TO_OEM') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Record settlement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Settled amount (₹)" htmlFor="wc-settled">
            <Input id="wc-settled" type="number" min="0" step="0.01" value={settled} onChange={(e) => setSettled(e.target.value)} />
          </Field>
          <Button
            disabled={oem.isPending || settled === ''}
            onClick={() =>
              oem.mutate(
                { status: 'SETTLED', settledAmountMinor: Math.round(Number(settled) * 100) },
                handlers('Settlement recorded'),
              )
            }
          >
            Mark settled
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}

function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="col-span-2">{children}</span>
    </div>
  );
}

function BackLink() {
  return (
    <Link
        href="/warranty"
        className="-ml-2 inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Warranty claims
      </Link>
  );
}

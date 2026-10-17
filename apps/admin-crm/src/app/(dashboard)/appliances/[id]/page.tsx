'use client';

import { Permission } from '@ac/types';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@ac/ui';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { ApplianceFormModal } from '@/components/repair/appliance-form-modal';
import { errorMessage, useCan, WarrantyPill } from '@/components/repair/repair-ui';
import {
  useAppliance,
  useApplianceHistory,
  useApplianceWarranty,
  useDeleteAppliance,
} from '@/hooks/use-repair';
import { humanize } from '@/lib/api/repair';
import { formatDate, formatDateTime } from '@/lib/format';

export default function ApplianceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const canManage = useCan(Permission.APPLIANCE_MANAGE);
  const [editOpen, setEditOpen] = React.useState(false);
  const { data: appliance, isLoading, error } = useAppliance(id);
  const { data: history } = useApplianceHistory(id);
  const { data: warranty } = useApplianceWarranty(id);
  const remove = useDeleteAppliance();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (error || !appliance) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-destructive">{error ? errorMessage(error) : 'Appliance not found'}</p>
      </div>
    );
  }

  const onDelete = () => {
    if (!window.confirm('Remove this appliance? Its history is kept.')) return;
    remove.mutate(appliance.id, {
      onSuccess: () => {
        toast.success('Appliance removed');
        router.push('/appliances');
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  return (
    <div className="space-y-6">
      <BackLink />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {appliance.brand} {appliance.modelNumber ?? ''}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {humanize(appliance.category)}
            {appliance.capacity ? ` · ${appliance.capacity}` : ''}
            {appliance.serialNumber ? ` · S/N ${appliance.serialNumber}` : ''}
            {appliance.customer ? (
              <>
                {' · '}
                <Link href={`/customers/${appliance.customer.id}`} className="text-primary hover:underline">
                  {appliance.customer.fullName}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        {canManage ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" /> Edit
            </Button>
            <Button size="sm" variant="outline" onClick={onDelete} disabled={remove.isPending}>
              <Trash2 className="size-4" /> Remove
            </Button>
          </div>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="order-2 min-w-0 space-y-6 lg:order-1 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Service history</CardTitle>
            </CardHeader>
            <CardContent>
              {!history ? (
                <Skeleton className="h-24 w-full" />
              ) : history.timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No service history yet.</p>
              ) : (
                <ol className="relative space-y-4 border-l pl-4">
                  {history.timeline.map((e) => (
                    <li key={`${e.type}-${e.id}`} className="text-sm">
                      <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border bg-background" />
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{humanize(e.type === 'jobCard' ? 'JOB_CARD' : e.type === 'warrantyClaim' ? 'WARRANTY' : 'BOOKING')}</Badge>
                        <EntryLink type={e.type} id={e.id} bookingId={e.bookingId} title={e.title} />
                        <span className="text-xs text-muted-foreground">{humanize(e.status)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{formatDateTime(e.at)}</div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {history?.jobCards.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Diagnoses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {history.jobCards.map((j) => (
                  <div key={j.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <Link href={`/job-cards/${j.id}`} className="font-medium hover:underline">
                        {j.booking.code}
                      </Link>
                      <span className="text-xs text-muted-foreground">{formatDate(j.completedAt)}</span>
                    </div>
                    {j.faultCodes.length ? (
                      <div className="text-xs text-muted-foreground">Codes: {j.faultCodes.join(', ')}</div>
                    ) : null}
                    <div>{j.diagnosis ?? '—'}</div>
                    {j.resolution ? <div className="text-muted-foreground">Fix: {j.resolution}</div> : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="order-1 space-y-6 lg:order-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Warranty & coverage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!warranty ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <>
                  <WarrantyPill label="Manufacturer" {...warranty.manufacturer} />
                  <WarrantyPill label="Extended" {...warranty.extended} />
                  <WarrantyPill label="Repair guarantee" active={warranty.repair.active} until={warranty.repair.until} />
                  <div className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <span className="text-muted-foreground">AMC</span>
                    <Badge variant={warranty.amcCovered ? 'success' : 'outline'}>
                      {warranty.amcCovered ? 'Covered' : 'Not covered'}
                    </Badge>
                  </div>
                  {warranty.repair.bookingId ? (
                    <Link href={`/bookings/${warranty.repair.bookingId}`} className="block text-xs text-primary hover:underline">
                      Repair guarantee from this booking →
                    </Link>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Detail label="Location">{appliance.installedLocation ?? '—'}</Detail>
              <Detail label="Purchased">{formatDate(appliance.purchaseDate)}</Detail>
              <Detail label="Installed">{formatDate(appliance.installDate)}</Detail>
              <Detail label="Last serviced">{formatDate(appliance.lastServicedAt)}</Detail>
              <Detail label="Warranty provider">{appliance.warrantyProvider ?? '—'}</Detail>
              {appliance.notes ? <p className="pt-2 text-muted-foreground">{appliance.notes}</p> : null}
            </CardContent>
          </Card>
        </aside>
      </div>

      <ApplianceFormModal open={editOpen} onOpenChange={setEditOpen} appliance={appliance} />
    </div>
  );
}

function EntryLink({
  type,
  id,
  bookingId,
  title,
}: {
  type: 'booking' | 'jobCard' | 'warrantyClaim';
  id: string;
  bookingId: string | null;
  title: string;
}) {
  const href =
    type === 'booking' ? `/bookings/${id}` : type === 'jobCard' ? `/job-cards/${id}` : `/warranty/${id}`;
  return (
    <Link href={href} className="font-medium hover:underline" data-booking={bookingId ?? undefined}>
      {title}
    </Link>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function BackLink() {
  return (
    <Link
        href="/appliances"
        className="-ml-2 inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Appliances
      </Link>
  );
}

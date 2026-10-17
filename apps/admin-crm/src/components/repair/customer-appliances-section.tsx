'use client';

import { Permission } from '@ac/types';
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@ac/ui';
import { Plus, Refrigerator } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { useAppliances } from '@/hooks/use-repair';
import { humanize } from '@/lib/api/repair';
import { formatDate } from '@/lib/format';

import { ApplianceFormModal } from './appliance-form-modal';
import { useCan, WarrantyBadge } from './repair-ui';

/** Self-contained "Appliances" card for the customer detail page. */
export function CustomerAppliancesSection({ customerId }: { customerId: string }) {
  const canView = useCan(Permission.APPLIANCE_VIEW);
  const canManage = useCan(Permission.APPLIANCE_MANAGE);
  const [open, setOpen] = React.useState(false);
  const { data, isLoading } = useAppliances({ customerId, pageSize: 50 }, canView);
  const items = data?.items ?? [];

  if (!canView) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Appliances</CardTitle>
        {canManage ? (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Add appliance
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : items.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Refrigerator className="size-4" aria-hidden /> No appliances registered yet.
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((a) => (
              <li key={a.id} className="relative space-y-1 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/appliances/${a.id}`} className="font-medium hover:underline after:absolute after:inset-0">
                    {a.brand} {a.modelNumber ?? ''}
                  </Link>
                  <WarrantyBadge manufacturerUntil={a.manufacturerWarrantyUntil} extendedUntil={a.extendedWarrantyUntil} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    {humanize(a.category)}
                    {a.capacity ? ` · ${a.capacity}` : ''}
                    {a.installedLocation ? ` · ${a.installedLocation}` : ''}
                    {a.serialNumber ? ` · S/N ${a.serialNumber}` : ''}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {a.lastServicedAt ? `Last serviced ${formatDate(a.lastServicedAt)}` : 'Never serviced'}
                  {' · '}
                  {a._count?.bookings ?? 0} {(a._count?.bookings ?? 0) === 1 ? 'booking' : 'bookings'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <ApplianceFormModal open={open} onOpenChange={setOpen} customerId={customerId} />
    </Card>
  );
}

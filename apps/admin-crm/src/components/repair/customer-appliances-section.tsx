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
import { useCan } from './repair-ui';

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
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <Link href={`/appliances/${a.id}`} className="font-medium hover:underline">
                    {a.brand} {a.modelNumber ?? ''}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {humanize(a.category)}
                    {a.capacity ? ` · ${a.capacity}` : ''}
                    {a.installedLocation ? ` · ${a.installedLocation}` : ''}
                    {a.serialNumber ? ` · S/N ${a.serialNumber}` : ''}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>Last serviced {formatDate(a.lastServicedAt)}</div>
                  <div>{a._count?.bookings ?? 0} bookings</div>
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

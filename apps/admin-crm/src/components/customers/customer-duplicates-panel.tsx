'use client';

import { Permission } from '@ac/types';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@ac/ui';
import { GitMerge } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { useCustomerDuplicates } from '@/hooks/use-customers';
import type { CustomerDetail, DuplicateMatch } from '@/lib/api/customers';
import { hasPermission, readSessionClaims } from '@/lib/rbac/permissions';

import { CustomerMergeModal } from './customer-merge-modal';

const REASON_LABEL: Record<string, string> = {
  phone: 'Same phone',
  email: 'Same email',
  name_pincode: 'Name + pincode',
  name: 'Similar name',
};

/** Lists likely duplicates of `customer` and offers merge in either direction. */
export function CustomerDuplicatesPanel({ customer }: { customer: CustomerDetail }) {
  const { data, isLoading } = useCustomerDuplicates(customer.id);
  const [pending, setPending] = React.useState<{
    duplicate: DuplicateMatch['customer']  ;
    survivor: DuplicateMatch['customer']  ;
  } | null>(null);
  const canMerge = hasPermission(Permission.CUSTOMER_MERGE, readSessionClaims().permissions);
  const items = data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitMerge className="size-4" /> Duplicates &amp; merge
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No likely duplicates found.</p>
        ) : (
          <ul className="divide-y">
            {items.map((d) => (
              <li key={d.customer.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <Link href={`/customers/${d.customer.id}`} className="font-medium text-primary hover:underline">
                    {d.customer.fullName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {d.customer.phone}
                    {d.customer.email ? ` · ${d.customer.email}` : ''} · {d.customer.totalBookings} bookings
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {d.reasons.map((r) => (
                      <Badge key={r} variant="warning">
                        {REASON_LABEL[r] ?? r}
                      </Badge>
                    ))}
                    <Badge variant="muted">score {Math.round(d.score * 100) / 100}</Badge>
                  </div>
                </div>
                {canMerge ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPending({ duplicate: d.customer, survivor: customer })}
                    >
                      Merge into this
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPending({ duplicate: customer, survivor: d.customer })}
                    >
                      Merge this into it
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CustomerMergeModal
        open={Boolean(pending)}
        onOpenChange={(o) => !o && setPending(null)}
        duplicate={pending?.duplicate ?? null}
        survivor={pending?.survivor ?? null}
      />
    </Card>
  );
}

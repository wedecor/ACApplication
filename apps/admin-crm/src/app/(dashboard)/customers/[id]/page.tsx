'use client';

import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@ac/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { BookingStatusBadge } from '@/components/bookings/booking-status-badge';
import { ContactButtons } from '@/components/common/contact-buttons';
import { CustomerCrmPanel, CustomerEditButton } from '@/components/customers/customer-crm-panel';
import { CustomerAppliancesSection } from '@/components/repair/customer-appliances-section';
import { useBookings } from '@/hooks/use-bookings';
import { useCustomer } from '@/hooks/use-customers';
import { formatWhen } from '@/lib/format';
import { categoryLabel } from '@/lib/labels';

function formatINR(minor: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: customer, isLoading, error } = useCustomer(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-4">
        <Link
        href="/customers"
        className="-ml-2 inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Customers
      </Link>
        <p className="text-sm text-destructive">
          {error ? (error).message : 'Customer not found'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/customers"
        className="-ml-2 inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Customers
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{customer.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {customer.phone}
            {customer.email ? ` · ${customer.email}` : null}
            {customer.city ? ` · ${customer.city.name}` : null}
          </p>
          <ContactButtons phone={customer.phone} />
        </div>
        <CustomerEditButton customer={customer} />
      </header>

      <dl className="grid grid-cols-3 divide-x rounded-lg border bg-card">
        <Stat label="Bookings" value={String(customer.totalBookings)} />
        <Stat label="Lifetime value" value={formatINR(customer.lifetimeValueMinor)} />
        <Stat label="Invoices" value={String(customer._count.invoices)} />
      </dl>

      <RecentBookings customerId={customer.id} />

      <CustomerAppliancesSection customerId={customer.id} />

      <CustomerCrmPanel customer={customer} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-3 py-3 sm:px-5">
      <dt className="truncate text-xs text-muted-foreground sm:text-sm">{label}</dt>
      <dd className="mt-0.5 truncate text-lg font-semibold tabular-nums sm:text-2xl">{value}</dd>
    </div>
  );
}

function RecentBookings({ customerId }: { customerId: string }) {
  const { data, isLoading, isError } = useBookings({ customerId, pageSize: 5, sort: 'scheduledAt:desc' });
  const items = data?.items ?? [];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent bookings</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {isLoading ? (
          <div className="space-y-2 px-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <p className="px-6 pb-3 text-sm text-danger-700">Couldn&apos;t load bookings.</p>
        ) : items.length === 0 ? (
          <p className="px-6 pb-3 text-sm text-muted-foreground">No bookings yet.</p>
        ) : (
          <ul className="divide-y">
            {items.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/bookings/${b.id}`}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-muted/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{b.serviceType || categoryLabel(b.category)}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {formatWhen(b.scheduledAt)} · {b.code}
                    </p>
                  </div>
                  <BookingStatusBadge status={b.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@ac/ui';
import { ArrowLeft, Phone } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { useCustomer } from '@/hooks/use-customers';

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
        <Link href="/customers" className="text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="inline size-4" /> Back to customers
        </Link>
        <p className="text-sm text-destructive">
          {error ? (error as Error).message : 'Customer not found'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/customers" className="text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="inline size-4" /> Back to customers
      </Link>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{customer.fullName}</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="size-3.5" aria-hidden />
          {customer.phone}
          {customer.email ? ` · ${customer.email}` : null}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{customer.totalBookings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lifetime value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatINR(customer.lifetimeValueMinor)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{customer._count.invoices}</p>
          </CardContent>
        </Card>
      </div>

      {customer.city ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Location</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {customer.city.name}, {customer.city.state}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

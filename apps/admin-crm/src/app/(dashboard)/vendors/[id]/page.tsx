'use client';

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@ac/ui';
import { ArrowLeft, Building2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { useVendor } from '@/hooks/use-inventory';
import { formatMinor, formatPercent } from '@/lib/format';
import { humanizeEnum } from '@/lib/labels';

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: vendor, isLoading, error } = useVendor(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="space-y-4">
        <Link
        href="/vendors"
        className="-ml-2 inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Vendors
      </Link>
        <p className="text-sm text-destructive">
          {error ? (error).message : 'Vendor not found'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/vendors"
        className="-ml-2 inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Vendors
      </Link>

      <header>
        <div className="flex items-center gap-2">
          <Building2 className="size-5 text-muted-foreground" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight">{vendor.companyName}</h1>
          <Badge variant="outline">{humanizeEnum(vendor.status)}</Badge>
        </div>
        <p className="mt-1 font-mono text-sm text-muted-foreground">{vendor.code}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <Card className="col-span-2 sm:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lifetime spend</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMinor(vendor.lifetimeSpendMinor)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">On-time rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPercent(vendor.onTimeRate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Purchase orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{vendor._count?.purchaseOrders ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          {vendor.contactPerson ? <p>{vendor.contactPerson}</p> : null}
          {vendor.phone ? <p>{vendor.phone}</p> : null}
          {vendor.email ? <p>{vendor.email}</p> : null}
          {vendor.gstin ? <p className="font-mono text-xs">GSTIN {vendor.gstin}</p> : null}
          <p>Net {vendor.paymentTermsDays} day payment terms</p>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Warehouse as WarehouseIcon } from 'lucide-react';

import {
  Badge,
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

import { useWarehouse, useWarehouseStats } from '@/hooks/use-inventory';
import { formatMinorCompact } from '@/lib/format';

interface WarehouseZone {
  id: string;
  code: string;
  name: string | null;
}

export default function WarehouseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: warehouse, isLoading, error } = useWarehouse(id);
  const { data: stats } = useWarehouseStats(id);

  const zones = (warehouse as { zones?: WarehouseZone[] } | undefined)?.zones ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !warehouse) {
    return (
      <div className="space-y-4">
        <Link href="/warehouses" className="text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="inline size-4" /> Back to warehouses
        </Link>
        <p className="text-sm text-destructive">
          {error ? (error as Error).message : 'Warehouse not found'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/warehouses" className="text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="inline size-4" /> Back to warehouses
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <WarehouseIcon className="size-5 text-muted-foreground" aria-hidden />
            <h1 className="text-2xl font-semibold tracking-tight">{warehouse.name}</h1>
            {warehouse.isActive ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}
          </div>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {warehouse.code} · {warehouse.kind.replace(/_/g, ' ')}
          </p>
        </div>
      </header>

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="SKUs" value={String(stats.skuCount)} />
          <Stat label="On hand" value={String(stats.totalQuantity)} />
          <Stat label="Reserved" value={String(stats.totalReserved)} />
          <Stat label="Valuation" value={formatMinorCompact(stats.totalValuationMinor)} />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Location</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {warehouse.addressLine1 ? <p>{warehouse.addressLine1}</p> : null}
          {warehouse.state || warehouse.pincode ? (
            <p>
              {[warehouse.state, warehouse.pincode].filter(Boolean).join(' · ')}
            </p>
          ) : null}
          {warehouse.gstin ? <p className="mt-2 font-mono text-xs">GSTIN {warehouse.gstin}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Zones ({zones.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {zones.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No zones configured yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((z) => (
                  <TableRow key={z.id}>
                    <TableCell className="font-mono text-xs">{z.code}</TableCell>
                    <TableCell>{z.name ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

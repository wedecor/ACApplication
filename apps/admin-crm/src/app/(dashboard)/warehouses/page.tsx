'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, Warehouse as WarehouseIcon } from 'lucide-react';

import {
  Badge,
  Button,
  EmptyState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ac/ui';

import { LoadError } from '@/components/common/load-error';
import { useWarehouses } from '@/hooks/use-inventory';

export default function WarehousesPage() {
  const { data, isLoading, error } = useWarehouses({ page: 1, pageSize: 50 });
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Warehouses</h1>
          <p className="text-sm text-muted-foreground">
            Multi-location stock — central depots, branch warehouses, vendor-returns + scrap.
          </p>
        </div>
        <Button asChild>
          <Link href="/warehouses/new">
            <Plus className="size-4" />
            New warehouse
          </Link>
        </Button>
      </header>

      {error ? <LoadError label="warehouses" message={(error as Error).message} /> : null}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">SKUs</TableHead>
              <TableHead className="text-right">Zones</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState
                    icon={WarehouseIcon}
                    title="No warehouses yet"
                    description="Add at least one warehouse before issuing POs or technician allocations."
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((wh) => (
                <TableRow key={wh.id}>
                  <TableCell>
                    <code className="font-mono text-xs">{wh.code}</code>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/warehouses/${wh.id}`} className="hover:underline">
                      {wh.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{wh.kind}</Badge>
                  </TableCell>
                  <TableCell>
                    {wh.pincode ? `${wh.state ?? ''} · ${wh.pincode}` : (wh.state ?? '—')}
                  </TableCell>
                  <TableCell className="text-right">{wh._count?.stocks ?? 0}</TableCell>
                  <TableCell className="text-right">{wh._count?.zones ?? 0}</TableCell>
                  <TableCell>
                    {wh.isActive ? (
                      <Badge>Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

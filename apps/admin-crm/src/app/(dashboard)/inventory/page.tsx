'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Boxes, Plus, Search } from 'lucide-react';
import { useDebounce } from 'use-debounce';

import {
  Badge,
  Button,
  EmptyState,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ac/ui';

import { Pagination } from '@/components/common/pagination';
import { useInventoryItems, useInventoryValuation } from '@/hooks/use-inventory';
import { formatMinor, formatMinorCompact } from '@/lib/format';

const TYPE_FILTERS: Array<{ id: string | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'SPARE_PART', label: 'Spare parts' },
  { id: 'CONSUMABLE', label: 'Consumables' },
  { id: 'TOOL', label: 'Tools' },
  { id: 'ACCESSORY', label: 'Accessories' },
  { id: 'APPLIANCE', label: 'Appliances' },
];

export default function InventoryPage() {
  const [filters, setFilters] = React.useState<Record<string, unknown>>({
    page: 1,
    pageSize: 20,
  });
  const [search, setSearch] = React.useState('');
  const [debouncedSearch] = useDebounce(search, 350);
  React.useEffect(() => {
    setFilters((f) => ({ ...f, search: debouncedSearch || undefined, page: 1 }));
  }, [debouncedSearch]);

  const { data, isLoading } = useInventoryItems(filters);
  const valuation = useInventoryValuation();
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Inventory catalogue</h1>
          <p className="text-sm text-muted-foreground">
            Track SKUs, stock levels, valuation and reorder points across every warehouse.
          </p>
        </div>
        <Button asChild>
          <Link href="/inventory/new">
            <Plus className="size-4" />
            New item
          </Link>
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Catalogue SKUs"
          value={data?.meta.total?.toLocaleString() ?? '—'}
          icon={<Boxes className="size-4" />}
          isLoading={isLoading}
        />
        <KpiCard
          label="Total inventory value"
          value={formatMinor(valuation.data?.totalValuationMinor)}
          isLoading={valuation.isLoading}
        />
        <KpiCard
          label="Total quantity on-hand"
          value={valuation.data?.totalQuantity?.toLocaleString() ?? '—'}
          isLoading={valuation.isLoading}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, brand or barcode"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {TYPE_FILTERS.map((f) => (
            <Button
              key={f.id}
              size="sm"
              variant={(filters.type ?? 'ALL') === f.id ? 'default' : 'outline'}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  type: f.id === 'ALL' ? undefined : f.id,
                  page: 1,
                }))
              }
            >
              {f.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant={filters.lowStockOnly ? 'destructive' : 'outline'}
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                lowStockOnly: prev.lowStockOnly ? undefined : true,
                page: 1,
              }))
            }
          >
            <AlertTriangle className="size-4" />
            Low stock
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">On hand</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Selling</TableHead>
              <TableHead className="text-right">Valuation</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <SkeletonRows />
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <EmptyState
                    icon={Boxes}
                    title="No catalogue items yet"
                    description="Add spare parts, consumables or tools to start tracking stock."
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">
                    <Link href={`/inventory/${it.id}`} className="hover:underline">
                      {it.name}
                    </Link>
                    {it.brand ? (
                      <div className="text-xs text-muted-foreground">{it.brand}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <code className="font-mono text-xs">{it.sku}</code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{it.type.replace('_', ' ')}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{it.totalQuantity ?? 0}</TableCell>
                  <TableCell className="text-right">{it.totalReserved ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <span className={it.lowStock ? 'font-semibold text-destructive' : ''}>
                      {it.available ?? 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{formatMinor(it.sellingPriceMinor)}</TableCell>
                  <TableCell className="text-right">
                    {formatMinorCompact(it.valuationMinor)}
                  </TableCell>
                  <TableCell>
                    {it.lowStock ? (
                      <AlertTriangle className="size-4 text-destructive" />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.meta.totalPages > 1 ? (
        <Pagination
          page={data.meta.page}
          pageSize={data.meta.pageSize}
          total={data.meta.total}
          totalPages={data.meta.totalPages}
          onPageChange={(p) => setFilters((prev) => ({ ...prev, page: p }))}
        />
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  isLoading,
  icon,
}: {
  label: string;
  value: string;
  isLoading?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-1 text-2xl font-semibold">
        {isLoading ? <Skeleton className="h-7 w-24" /> : value}
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell colSpan={9}>
            <Skeleton className="h-6 w-full" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

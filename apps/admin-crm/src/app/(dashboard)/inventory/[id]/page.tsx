'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Boxes } from 'lucide-react';

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

import { useInventoryItem } from '@/hooks/use-inventory';
import { formatMinor, formatMinorCompact } from '@/lib/format';

export default function InventoryItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: item, isLoading, error } = useInventoryItem(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="space-y-4">
        <Link href="/inventory" className="text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="inline size-4" /> Back to catalogue
        </Link>
        <p className="text-sm text-destructive">
          {error ? (error as Error).message : 'Item not found'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/inventory" className="text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="inline size-4" /> Back to catalogue
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="size-5 text-muted-foreground" aria-hidden />
            <h1 className="text-2xl font-semibold tracking-tight">{item.name}</h1>
            {item.lowStock ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="size-3" aria-hidden />
                Low stock
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {item.sku}
            {item.barcode ? ` · ${item.barcode}` : null}
          </p>
        </div>
        <Badge variant="outline">{item.type.replace(/_/g, ' ')}</Badge>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="On hand" value={String(item.totalQuantity ?? 0)} />
        <Stat label="Reserved" value={String(item.totalReserved ?? 0)} />
        <Stat label="Available" value={String(item.available ?? 0)} />
        <Stat label="Valuation" value={formatMinorCompact(item.valuationMinor ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Cost" value={formatMinor(item.costPriceMinor)} />
            <Row label="Selling" value={formatMinor(item.sellingPriceMinor)} />
            <Row label="GST" value={`${(item.gstRateBps / 100).toFixed(2)}%`} />
            {item.hsnCode ? <Row label="HSN" value={item.hsnCode} /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Catalogue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {item.brand ? <Row label="Brand" value={item.brand} /> : null}
            {item.category ? <Row label="Category" value={item.category} /> : null}
            <Row label="Unit" value={item.unit} />
            <Row label="Reorder at" value={String(item.defaultReorderLevel)} />
            <Row label="Reorder qty" value={String(item.defaultReorderQty)} />
          </CardContent>
        </Card>
      </div>

      {item.description ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{item.description}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock by warehouse</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!item.stocks?.length ? (
            <p className="p-6 text-sm text-muted-foreground">
              No warehouse stock yet. Receive a purchase order or post an adjustment to add
              quantity.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Reorder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.stocks.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      {s.warehouse?.name ?? s.warehouseId}
                      {s.warehouse?.code ? (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {s.warehouse.code}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">{s.quantity}</TableCell>
                    <TableCell className="text-right">{s.reservedQuantity}</TableCell>
                    <TableCell className="text-right">{s.reorderLevel ?? '—'}</TableCell>
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
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

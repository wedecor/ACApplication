'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@ac/ui';

import { useCreateInventoryItem } from '@/hooks/use-inventory';
import type { InventoryItemType, InventoryUnit } from '@/lib/api/inventory';

const TYPES: { value: InventoryItemType; label: string }[] = [
  { value: 'SPARE_PART', label: 'Spare part' },
  { value: 'CONSUMABLE', label: 'Consumable' },
  { value: 'TOOL', label: 'Tool' },
  { value: 'ACCESSORY', label: 'Accessory' },
  { value: 'APPLIANCE', label: 'Appliance' },
];

const UNITS: { value: InventoryUnit; label: string }[] = [
  { value: 'PIECE', label: 'Piece' },
  { value: 'SET', label: 'Set' },
  { value: 'BOX', label: 'Box' },
  { value: 'PACK', label: 'Pack' },
  { value: 'METER', label: 'Meter' },
  { value: 'KILOGRAM', label: 'Kilogram' },
  { value: 'LITRE', label: 'Litre' },
];

function rupeesToMinor(value: string): number {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export default function NewInventoryItemPage() {
  const router = useRouter();
  const create = useCreateInventoryItem();

  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<InventoryItemType>('SPARE_PART');
  const [unit, setUnit] = React.useState<InventoryUnit>('PIECE');
  const [brand, setBrand] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [sku, setSku] = React.useState('');
  const [costPrice, setCostPrice] = React.useState('');
  const [sellingPrice, setSellingPrice] = React.useState('');
  const [gstPercent, setGstPercent] = React.useState('18');
  const [hsnCode, setHsnCode] = React.useState('');
  const [reorderLevel, setReorderLevel] = React.useState('5');
  const [reorderQty, setReorderQty] = React.useState('10');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Item name is required');
      return;
    }

    try {
      const created = await create.mutateAsync({
        name: name.trim(),
        type,
        unit,
        brand: brand.trim() || undefined,
        category: category.trim() || undefined,
        description: description.trim() || undefined,
        sku: sku.trim() || undefined,
        costPriceMinor: rupeesToMinor(costPrice),
        sellingPriceMinor: rupeesToMinor(sellingPrice),
        gstRateBps: Math.round(Number.parseFloat(gstPercent || '0') * 100),
        hsnCode: hsnCode.trim() || undefined,
        defaultReorderLevel: Number.parseInt(reorderLevel, 10) || 0,
        defaultReorderQty: Number.parseInt(reorderQty, 10) || 0,
      });
      toast.success(`Created ${created.name} (${created.sku})`);
      router.push(`/inventory/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create item');
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/inventory"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to catalogue
      </Link>

      <header>
        <h1 className="text-xl font-semibold tracking-tight">New catalogue item</h1>
        <p className="text-sm text-muted-foreground">
          SKU and barcode are auto-generated if left blank. Stock is added via purchase orders or
          adjustments after creation.
        </p>
      </header>

      <form onSubmit={(e) => void submit(e)}>
        <Card>
          <CardHeader>
            <CardTitle>Item details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. AC gas refill R410A"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as InventoryItemType)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <select
                id="unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value as InventoryUnit)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sku">SKU (optional)</Label>
              <Input
                id="sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Auto-generated if empty"
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost">Cost price (₹)</Label>
              <Input
                id="cost"
                type="number"
                min={0}
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sell">Selling price (₹)</Label>
              <Input
                id="sell"
                type="number"
                min={0}
                step="0.01"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gst">GST (%)</Label>
              <Input
                id="gst"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={gstPercent}
                onChange={(e) => setGstPercent(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hsn">HSN code</Label>
              <Input id="hsn" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reorder-level">Reorder level</Label>
              <Input
                id="reorder-level"
                type="number"
                min={0}
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reorder-qty">Reorder quantity</Label>
              <Input
                id="reorder-qty"
                type="number"
                min={0}
                value={reorderQty}
                onChange={(e) => setReorderQty(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex gap-3">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create item'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/inventory">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}

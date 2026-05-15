'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@ac/ui';

import {
  useCreatePurchaseOrder,
  useInventoryItems,
  useVendors,
  useWarehouses,
} from '@/hooks/use-inventory';

interface LineDraft {
  itemId: string;
  quantity: string;
  unitCost: string;
}

function rupeesToMinor(value: string): number {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const create = useCreatePurchaseOrder();
  const vendors = useVendors({ page: 1, pageSize: 100 });
  const warehouses = useWarehouses({ page: 1, pageSize: 100 });
  const items = useInventoryItems({ page: 1, pageSize: 200, isActive: true });

  const [vendorId, setVendorId] = React.useState('');
  const [warehouseId, setWarehouseId] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [lines, setLines] = React.useState<LineDraft[]>([
    { itemId: '', quantity: '1', unitCost: '0' },
  ]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendorId || !warehouseId) {
      toast.error('Select vendor and warehouse');
      return;
    }
    const parsed = lines.filter((l) => l.itemId && Number(l.quantity) > 0);
    if (parsed.length === 0) {
      toast.error('Add at least one line item');
      return;
    }
    try {
      const created = await create.mutateAsync({
        vendorId,
        warehouseId,
        notes: notes.trim() || undefined,
        items: parsed.map((l) => ({
          itemId: l.itemId,
          quantity: Number.parseInt(l.quantity, 10),
          unitCostMinor: rupeesToMinor(l.unitCost),
        })),
      });
      toast.success(`Created PO ${created.number}`);
      router.push(`/purchase-orders/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create PO');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/purchase-orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to purchase orders
      </Link>

      <header>
        <h1 className="text-xl font-semibold tracking-tight">New purchase order</h1>
        <p className="text-sm text-muted-foreground">Draft a PO — submit for approval from the detail page.</p>
      </header>

      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Header</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor</Label>
              <select
                id="vendor"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                required
              >
                <option value="">Select vendor</option>
                {(vendors.data?.items ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.companyName} ({v.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="warehouse">Receiving warehouse</Label>
              <select
                id="warehouse"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                required
              >
                <option value="">Select warehouse</option>
                {(warehouses.data?.items ?? []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Line items</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setLines((prev) => [...prev, { itemId: '', quantity: '1', unitCost: '0' }])
              }
            >
              <Plus className="size-4" />
              Add line
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {lines.map((line, idx) => (
              <div key={idx} className="grid gap-2 rounded-md border p-3 sm:grid-cols-12">
                <div className="sm:col-span-5">
                  <Label className="text-xs">Item</Label>
                  <select
                    value={line.itemId}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) => (i === idx ? { ...l, itemId: e.target.value } : l)),
                      )
                    }
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="">Select item</option>
                    {(items.data?.items ?? []).map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.sku} — {it.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)),
                      )
                    }
                    className="mt-1"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Label className="text-xs">Unit cost (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.unitCost}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) => (i === idx ? { ...l, unitCost: e.target.value } : l)),
                      )
                    }
                    className="mt-1"
                  />
                </div>
                <div className="flex items-end sm:col-span-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={lines.length <= 1}
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create draft PO'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/purchase-orders">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}

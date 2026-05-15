'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@ac/ui';

import {
  useCreateTransfer,
  useInventoryItems,
  useWarehouses,
} from '@/hooks/use-inventory';

interface LineDraft {
  itemId: string;
  quantity: string;
}

export default function NewTransferPage() {
  const router = useRouter();
  const create = useCreateTransfer();
  const warehouses = useWarehouses({ page: 1, pageSize: 100 });
  const items = useInventoryItems({ page: 1, pageSize: 200, isActive: true });

  const [sourceWarehouseId, setSource] = React.useState('');
  const [destWarehouseId, setDest] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [lines, setLines] = React.useState<LineDraft[]>([{ itemId: '', quantity: '1' }]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceWarehouseId || !destWarehouseId) {
      toast.error('Select source and destination warehouses');
      return;
    }
    if (sourceWarehouseId === destWarehouseId) {
      toast.error('Source and destination must differ');
      return;
    }
    const parsed = lines.filter((l) => l.itemId && Number(l.quantity) > 0);
    if (parsed.length === 0) {
      toast.error('Add at least one line item');
      return;
    }
    try {
      const created = await create.mutateAsync({
        sourceWarehouseId,
        destWarehouseId,
        notes: notes.trim() || undefined,
        items: parsed.map((l) => ({
          itemId: l.itemId,
          quantity: Number.parseInt(l.quantity, 10),
        })),
      });
      toast.success(`Created transfer ${created.number}`);
      router.push(`/transfers/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create transfer');
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/transfers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to transfers
      </Link>

      <header>
        <h1 className="text-xl font-semibold tracking-tight">New stock transfer</h1>
        <p className="text-sm text-muted-foreground">Request stock movement between warehouses.</p>
      </header>

      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Route</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="source">Source warehouse</Label>
              <select
                id="source"
                value={sourceWarehouseId}
                onChange={(e) => setSource(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                required
              >
                <option value="">Select source</option>
                {(warehouses.data?.items ?? []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dest">Destination warehouse</Label>
              <select
                id="dest"
                value={destWarehouseId}
                onChange={(e) => setDest(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                required
              >
                <option value="">Select destination</option>
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
            <CardTitle>Items</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setLines((prev) => [...prev, { itemId: '', quantity: '1' }])}
            >
              <Plus className="size-4" />
              Add line
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {lines.map((line, idx) => (
              <div key={idx} className="grid gap-2 rounded-md border p-3 sm:grid-cols-12">
                <div className="sm:col-span-8">
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
                <div className="sm:col-span-3">
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
                <div className="flex items-end sm:col-span-1">
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

        <footer className="flex gap-3">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create transfer request'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/transfers">Cancel</Link>
          </Button>
        </footer>
      </form>
    </section>
  );
}

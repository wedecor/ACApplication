'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@ac/ui';

import { useCreateInvoice } from '@/hooks/use-finance';
import { formatMinor } from '@/lib/format';

interface LineItemDraft {
  description: string;
  quantity: number;
  unitPriceMinor: number;
  taxRateBps: number;
  discountMinor: number;
  hsnSacCode?: string;
}

const blankLine = (): LineItemDraft => ({
  description: '',
  quantity: 1,
  unitPriceMinor: 0,
  taxRateBps: 1800,
  discountMinor: 0,
});

export default function NewInvoicePage() {
  const router = useRouter();
  const sp = useSearchParams();
  const bookingId = sp.get('bookingId') ?? undefined;
  const customerIdFromUrl = sp.get('customerId') ?? '';

  const [customerId, setCustomerId] = React.useState(customerIdFromUrl);
  const [lines, setLines] = React.useState<LineItemDraft[]>([blankLine()]);
  const [gstEnabled, setGstEnabled] = React.useState(true);
  const [gstNumber, setGstNumber] = React.useState('');
  const [placeOfSupply, setPlaceOfSupply] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [terms, setTerms] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');

  const create = useCreateInvoice();

  const totals = React.useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const l of lines) {
      const gross = Math.max(0, l.quantity * l.unitPriceMinor - l.discountMinor);
      subtotal += gross;
      tax += Math.round((gross * l.taxRateBps) / 10000);
    }
    return { subtotal, tax, total: subtotal + tax };
  }, [lines]);

  function updateLine(idx: number, patch: Partial<LineItemDraft>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }
  function addLine() {
    setLines((prev) => [...prev, blankLine()]);
  }

  async function submit() {
    if (!customerId) {
      toast.error('Customer is required');
      return;
    }
    if (lines.some((l) => !l.description.trim())) {
      toast.error('Every line item needs a description');
      return;
    }
    try {
      const created = await create.mutateAsync({
        customerId,
        bookingId,
        gstEnabled,
        gstNumber: gstEnabled ? gstNumber || undefined : undefined,
        placeOfSupply: gstEnabled ? placeOfSupply || undefined : undefined,
        notes: notes || undefined,
        terms: terms || undefined,
        dueDate: dueDate || undefined,
        lineItems: lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitPriceMinor: l.unitPriceMinor,
          discountMinor: l.discountMinor,
          taxRateBps: gstEnabled ? l.taxRateBps : 0,
          hsnSacCode: l.hsnSacCode,
        })),
      });
      toast.success(`Invoice ${created.number} created`);
      router.push(`/invoices/${created.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">New invoice</h1>
        <p className="text-sm text-muted-foreground">
          {bookingId ? `From booking ${bookingId.slice(0, 8)}…` : 'Ad-hoc invoice'}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Bill to</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="customer">Customer ID</Label>
            <Input
              id="customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="cust_…"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="due">Due date</Label>
            <Input
              id="due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Line items</CardTitle>
          <Button size="sm" variant="outline" onClick={addLine}>
            <Plus className="size-4" /> Add line
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Unit (₹)</th>
                <th className="px-3 py-2 text-right">Discount (₹)</th>
                <th className="px-3 py-2 text-right">GST %</th>
                <th className="px-3 py-2 text-right">HSN</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines.map((line, idx) => {
                const gross = Math.max(0, line.quantity * line.unitPriceMinor - line.discountMinor);
                const tax = Math.round((gross * line.taxRateBps) / 10000);
                return (
                  <tr key={idx}>
                    <td className="px-2 py-1.5">
                      <Input
                        value={line.description}
                        onChange={(e) => updateLine(idx, { description: e.target.value })}
                        placeholder="Service description"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        min={0.01}
                        step="0.01"
                        className="w-20 text-right"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(idx, { quantity: Number(e.target.value) || 0 })
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        className="w-28 text-right"
                        value={(line.unitPriceMinor / 100).toString()}
                        onChange={(e) =>
                          updateLine(idx, {
                            unitPriceMinor: Math.round(Number(e.target.value) * 100),
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        className="w-24 text-right"
                        value={(line.discountMinor / 100).toString()}
                        onChange={(e) =>
                          updateLine(idx, {
                            discountMinor: Math.round(Number(e.target.value) * 100),
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={line.taxRateBps}
                        onChange={(e) =>
                          updateLine(idx, { taxRateBps: Number(e.target.value) })
                        }
                        className="w-20 rounded border bg-background px-2 py-1.5 text-right"
                      >
                        <option value={0}>0%</option>
                        <option value={500}>5%</option>
                        <option value={1200}>12%</option>
                        <option value={1800}>18%</option>
                        <option value={2800}>28%</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        className="w-24"
                        value={line.hsnSacCode ?? ''}
                        onChange={(e) => updateLine(idx, { hsnSacCode: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {formatMinor(gross + tax)}
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-rose-500"
                        onClick={() => removeLine(idx)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center gap-2">
            <input
              id="gst"
              type="checkbox"
              checked={gstEnabled}
              onChange={(e) => setGstEnabled(e.target.checked)}
            />
            <Label htmlFor="gst">GST enabled</Label>
          </div>
          {gstEnabled && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Customer GSTIN</Label>
                <Input value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Place of supply (state code)</Label>
                <Input
                  value={placeOfSupply}
                  onChange={(e) => setPlaceOfSupply(e.target.value)}
                  placeholder="e.g. KA, MH, DL"
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Notes</Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label>Terms</Label>
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={2}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm">
          <div>Subtotal: <strong className="tabular-nums">{formatMinor(totals.subtotal)}</strong></div>
          <div>Tax: <strong className="tabular-nums">{formatMinor(totals.tax)}</strong></div>
          <div className="text-base">
            Total: <strong className="tabular-nums">{formatMinor(totals.total)}</strong>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Save draft'}
          </Button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@ac/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { CustomerPicker } from '@/components/sales/customer-picker';
import { useCustomer } from '@/hooks/use-customers';
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
  const { data: selectedCustomer } = useCustomer(customerId || undefined);
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
        <h1 className="text-2xl font-bold tracking-tight">New invoice</h1>
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
            <Label htmlFor="customer-search">Customer</Label>
            {customerId ? (
              <div className="flex h-10 items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 text-sm">
                <span className="min-w-0 truncate">
                  {selectedCustomer ? (
                    <>
                      <span className="font-medium">{selectedCustomer.fullName}</span>{' '}
                      <span className="text-muted-foreground">{selectedCustomer.phone}</span>
                    </>
                  ) : (
                    'Loading customer…'
                  )}
                </span>
                <button
                  type="button"
                  className="shrink-0 text-sm font-medium text-primary hover:underline"
                  onClick={() => setCustomerId('')}
                >
                  Change
                </button>
              </div>
            ) : (
              <CustomerPicker
                inputId="customer-search"
                placeholder="Search by name or phone"
                onPick={(c) => setCustomerId(c.id)}
              />
            )}
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
        <CardContent className="space-y-3">
          {lines.map((line, idx) => {
            const gross = Math.max(0, line.quantity * line.unitPriceMinor - line.discountMinor);
            const tax = Math.round((gross * line.taxRateBps) / 10000);
            const fid = (name: string) => `line-${idx}-${name}`;
            return (
              <fieldset
                key={idx}
                className="grid grid-cols-2 gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,3fr)_repeat(5,minmax(0,1fr))_auto] md:items-end md:border-0 md:p-0"
              >
                <legend className="sr-only">Line {idx + 1}</legend>
                <div className="col-span-2 space-y-1 md:col-span-1">
                  <Label htmlFor={fid('desc')} className="text-xs text-muted-foreground">
                    Description
                  </Label>
                  <Input
                    id={fid('desc')}
                    value={line.description}
                    onChange={(e) => updateLine(idx, { description: e.target.value })}
                    placeholder="Service description"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={fid('qty')} className="text-xs text-muted-foreground">
                    Qty
                  </Label>
                  <Input
                    id={fid('qty')}
                    type="number"
                    inputMode="decimal"
                    min={0.01}
                    step="0.01"
                    className="text-right"
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={fid('unit')} className="text-xs text-muted-foreground">
                    Unit price (₹)
                  </Label>
                  <Input
                    id={fid('unit')}
                    type="number"
                    inputMode="decimal"
                    className="text-right"
                    value={(line.unitPriceMinor / 100).toString()}
                    onChange={(e) => updateLine(idx, { unitPriceMinor: Math.round(Number(e.target.value) * 100) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={fid('disc')} className="text-xs text-muted-foreground">
                    Discount (₹)
                  </Label>
                  <Input
                    id={fid('disc')}
                    type="number"
                    inputMode="decimal"
                    className="text-right"
                    value={(line.discountMinor / 100).toString()}
                    onChange={(e) => updateLine(idx, { discountMinor: Math.round(Number(e.target.value) * 100) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={fid('gst')} className="text-xs text-muted-foreground">
                    GST
                  </Label>
                  <select
                    id={fid('gst')}
                    value={line.taxRateBps}
                    onChange={(e) => updateLine(idx, { taxRateBps: Number(e.target.value) })}
                    className="h-10 w-full rounded-md border bg-background px-2 text-right text-sm"
                  >
                    <option value={0}>0%</option>
                    <option value={500}>5%</option>
                    <option value={1200}>12%</option>
                    <option value={1800}>18%</option>
                    <option value={2800}>28%</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={fid('hsn')} className="text-xs text-muted-foreground">
                    HSN / SAC
                  </Label>
                  <Input
                    id={fid('hsn')}
                    value={line.hsnSacCode ?? ''}
                    onChange={(e) => updateLine(idx, { hsnSacCode: e.target.value })}
                  />
                </div>
                <div className="col-span-2 flex items-center justify-between gap-2 border-t pt-2 md:col-span-1 md:flex-col md:items-end md:border-0 md:pt-0">
                  <span className="text-sm">
                    <span className="text-muted-foreground md:hidden">Line total </span>
                    <span className="font-medium tabular-nums">{formatMinor(gross + tax)}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove line ${idx + 1}`}
                    className="grid size-10 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-40"
                    disabled={lines.length === 1}
                    onClick={() => removeLine(idx)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </fieldset>
            );
          })}
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
          {gstEnabled ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="new-customer-gstin">Customer GSTIN</Label>
                <Input id="new-customer-gstin" value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-place-of-supply-state-code">Place of supply (state code)</Label>
                <Input id="new-place-of-supply-state-code"
                  value={placeOfSupply}
                  onChange={(e) => setPlaceOfSupply(e.target.value)}
                  placeholder="e.g. KA, MH, DL"
                />
              </div>
            </div> : null}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="new-notes">Notes</Label>
              <textarea id="new-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-terms">Terms</Label>
              <textarea id="new-terms"
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

'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, Send, X } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@ac/ui';
import { toast } from 'sonner';

import { useInvoice, useInvoiceAction } from '@/hooks/use-finance';
import { invoicesApi } from '@/lib/api/invoices';
import { formatDate, formatDateTime, formatMinor } from '@/lib/format';

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, isLoading } = useInvoice(id);
  const actions = useInvoiceAction(id);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <Link
            href="/invoices"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> Back to invoices
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">
            Invoice {data.number}
            <Badge className="ml-3 align-middle">{data.status}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.customer?.fullName} •{' '}
            {data.bookingId ? `Booking ${data.bookingId.slice(0, 8)}…` : 'Ad-hoc invoice'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={invoicesApi.downloadPdfUrl(id)}
            target="_blank"
            rel="noreferrer"
          >
            <Button variant="outline" size="sm">
              <Download className="size-4" />
              PDF
            </Button>
          </Link>
          {data.status === 'DRAFT' && (
            <Button
              size="sm"
              onClick={() =>
                actions.send.mutate(undefined, {
                  onSuccess: () => toast.success('Invoice sent'),
                  onError: (e) => toast.error((e as Error).message),
                })
              }
              disabled={actions.send.isPending}
            >
              <Send className="size-4" />
              Send
            </Button>
          )}
          {['DRAFT', 'SENT', 'PARTIALLY_PAID'].includes(data.status) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                actions.cancel.mutate('Cancelled by admin', {
                  onSuccess: () => toast.success('Invoice cancelled'),
                })
              }
            >
              <X className="size-4" />
              Cancel
            </Button>
          )}
          <RecordPaymentDialog
            outstandingMinor={data.dueAmountMinor}
            currency={data.currency}
            onSubmit={(body) =>
              actions.recordPayment.mutate(body, {
                onSuccess: () => toast.success('Payment recorded'),
              })
            }
          />
          {data.amountPaidMinor > 0 && data.amountRefundedMinor < data.amountPaidMinor && (
            <RefundDialog
              maxMinor={data.amountPaidMinor - data.amountRefundedMinor}
              currency={data.currency}
              onSubmit={(body) =>
                actions.refund.mutate(body, {
                  onSuccess: () => toast.success('Refund processed'),
                })
              }
            />
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total" value={formatMinor(data.totalMinor, data.currency)} />
        <Stat label="Paid" value={formatMinor(data.amountPaidMinor, data.currency)} tone="positive" />
        <Stat label="Due" value={formatMinor(data.dueAmountMinor, data.currency)} tone="negative" />
        <Stat label="Refunded" value={formatMinor(data.amountRefundedMinor, data.currency)} />
      </section>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Line items</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="meta">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Description</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Unit</th>
                    <th className="px-4 py-2 text-right">Discount</th>
                    <th className="px-4 py-2 text-right">Tax</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.lineItems.map((li) => (
                    <tr key={li.id}>
                      <td className="px-4 py-2">{li.description}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{li.quantity}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatMinor(li.unitPriceMinor, data.currency)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatMinor(li.discountMinor, data.currency)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatMinor(li.taxMinor, data.currency)} ({li.taxRateBps / 100}%)
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">
                        {formatMinor(li.totalMinor, data.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-muted/40">
                  <tr>
                    <td className="px-4 py-2 text-right" colSpan={5}>
                      <span className="text-xs uppercase text-muted-foreground">Subtotal</span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatMinor(data.subtotalMinor, data.currency)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-right" colSpan={5}>
                      <span className="text-xs uppercase text-muted-foreground">Tax</span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatMinor(data.taxMinor, data.currency)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-right" colSpan={5}>
                      <span className="text-xs uppercase text-muted-foreground">Total</span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">
                      {formatMinor(data.totalMinor, data.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Payment history</CardTitle>
            </CardHeader>
            <CardContent>
              {data.payments && data.payments.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 text-left">Captured at</th>
                      <th className="px-2 py-2 text-left">Method</th>
                      <th className="px-2 py-2 text-left">Status</th>
                      <th className="px-2 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="px-2 py-2">{formatDateTime(p.capturedAt)}</td>
                        <td className="px-2 py-2">{p.method}</td>
                        <td className="px-2 py-2">
                          <Badge variant="outline">{p.status}</Badge>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {formatMinor(p.amountMinor, data.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-muted-foreground">No payments yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meta">
          <Card>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Issue date" value={formatDate(data.issueDate)} />
              <Field label="Due date" value={formatDate(data.dueDate)} />
              <Field label="Sent at" value={formatDateTime(data.sentAt)} />
              <Field label="Paid at" value={formatDateTime(data.paidAt)} />
              <Field label="GST enabled" value={data.gstEnabled ? 'Yes' : 'No'} />
              <Field label="GSTIN" value={data.gstNumber ?? '—'} />
              <Field label="Place of supply" value={data.placeOfSupply ?? '—'} />
              <Field label="Currency" value={data.currency} />
              {data.notes ? <Field label="Notes" value={data.notes} /> : null}
              {data.terms ? <Field label="Terms" value={data.terms} /> : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
}) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <span className="text-xs uppercase text-muted-foreground">{label}</span>
        <div
          className={`text-lg font-semibold tabular-nums ${
            tone === 'positive'
              ? 'text-emerald-600'
              : tone === 'negative'
                ? 'text-rose-600'
                : ''
          }`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function RecordPaymentDialog({
  outstandingMinor,
  currency,
  onSubmit,
}: {
  outstandingMinor: number;
  currency: string;
  onSubmit: (body: {
    amountMinor: number;
    method: string;
    gatewayRef?: string;
    notes?: string;
  }) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState((outstandingMinor / 100).toString());
  const [method, setMethod] = React.useState('CASH');
  const [ref, setRef] = React.useState('');
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={outstandingMinor <= 0}>
        Record payment
      </Button>
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Record manual payment</ModalTitle>
            <ModalDescription>
              Outstanding: {formatMinor(outstandingMinor, currency)}
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-3 p-1">
            <label className="block text-sm">
              Amount ({currency})
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                min="0"
                step="0.01"
              />
            </label>
            <label className="block text-sm">
              Method
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option>CASH</option>
                <option>UPI</option>
                <option>CARD</option>
                <option>BANK_TRANSFER</option>
                <option>WALLET</option>
              </select>
            </label>
            <label className="block text-sm">
              Reference (optional)
              <Input value={ref} onChange={(e) => setRef(e.target.value)} />
            </label>
          </div>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onSubmit({
                  amountMinor: Math.round(Number(amount) * 100),
                  method,
                  gatewayRef: ref || undefined,
                });
                setOpen(false);
              }}
            >
              Record payment
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

function RefundDialog({
  maxMinor,
  currency,
  onSubmit,
}: {
  maxMinor: number;
  currency: string;
  onSubmit: (body: { amountMinor: number; reason?: string }) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState((maxMinor / 100).toString());
  const [reason, setReason] = React.useState('');
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Refund
      </Button>
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Refund invoice</ModalTitle>
            <ModalDescription>
              Refundable: {formatMinor(maxMinor, currency)}
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-3 p-1">
            <label className="block text-sm">
              Amount ({currency})
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                max={maxMinor / 100}
              />
            </label>
            <label className="block text-sm">
              Reason
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
          </div>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onSubmit({ amountMinor: Math.round(Number(amount) * 100), reason });
                setOpen(false);
              }}
            >
              Process refund
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

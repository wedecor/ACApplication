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
import { downloadInvoicePdf } from '@/lib/api/invoices';
import { formatDate, formatDateTime, formatMinor } from '@/lib/format';
import { humanizeEnum } from '@/lib/labels';

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
            className="-ml-2 inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden /> Invoices
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            Invoice {data.number}
            <Badge className="ml-3 align-middle">{humanizeEnum(data.status)}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.customer?.fullName} •{' '}
            {data.bookingId ? (
              <Link href={`/bookings/${data.bookingId}`} className="text-primary hover:underline">
                View booking
              </Link>
            ) : (
              'Ad-hoc invoice'
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void downloadInvoicePdf(id, data.number).catch((err: Error) => toast.error(err.message))
            }
          >
            <Download aria-hidden />
            Download PDF
          </Button>
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
        <Stat
          label="Due"
          value={formatMinor(data.dueAmountMinor, data.currency)}
          tone={data.dueAmountMinor > 0 ? 'negative' : undefined}
        />
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
            <CardContent className="p-0">
              <ul className="divide-y">
                {data.lineItems.map((li) => (
                  <li key={li.id} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{li.description}</p>
                      <p className="text-muted-foreground tabular-nums">
                        {li.quantity} × {formatMinor(li.unitPriceMinor, data.currency)}
                        {li.discountMinor ? ` · −${formatMinor(li.discountMinor, data.currency)}` : ''}
                        {` · GST ${li.taxRateBps / 100}% ${formatMinor(li.taxMinor, data.currency)}`}
                      </p>
                    </div>
                    <p className="shrink-0 font-medium tabular-nums">{formatMinor(li.totalMinor, data.currency)}</p>
                  </li>
                ))}
              </ul>
              <dl className="space-y-1 border-t bg-muted/40 px-4 py-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="tabular-nums">{formatMinor(data.subtotalMinor, data.currency)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Tax</dt>
                  <dd className="tabular-nums">{formatMinor(data.taxMinor, data.currency)}</dd>
                </div>
                <div className="flex justify-between gap-4 font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatMinor(data.totalMinor, data.currency)}</dd>
                </div>
              </dl>
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
                  <thead className="text-sm text-muted-foreground">
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
                          <Badge variant="outline">{humanizeEnum(p.status)}</Badge>
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
        <span className="text-sm text-muted-foreground">{label}</span>
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
      <div className="text-sm text-muted-foreground">{label}</div>
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

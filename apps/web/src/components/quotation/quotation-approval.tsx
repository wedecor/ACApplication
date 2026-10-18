'use client';

import { Badge, Button, Card, CardContent, Label, Spinner } from '@ac/ui';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { ApiClientError,apiFetch } from '@/lib/api-client';
import {
  formatMinorINR,
  formatQuoteDate,
  type PublicQuotation,
  quotationStage,
} from '@/lib/quotation';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error' }
  | { kind: 'ready'; quote: PublicQuotation };

/**
 * Public page where a customer reviews a technician's on-site quotation and
 * approves or declines it. The view token in the URL is the only credential.
 */
export function QuotationApproval({ token }: { token: string }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const reasonId = useId();
  const path = `/quotations/public/${encodeURIComponent(token)}`;

  useEffect(() => {
    let live = true;
    apiFetch<PublicQuotation>(path)
      .then((quote) => live && setState({ kind: 'ready', quote }))
      .catch((err: unknown) => {
        if (!live) return;
        setState({ kind: err instanceof ApiClientError && err.status === 404 ? 'missing' : 'error' });
      });
    return () => {
      live = false;
    };
  }, [path]);

  async function decide(action: 'approve' | 'reject') {
    setBusy(action);
    setActionError(null);
    try {
      const quote = await apiFetch<PublicQuotation>(`${path}/${action}`, {
        method: 'POST',
        body: action === 'reject' ? { reason: reason.trim() || undefined } : {},
      });
      setState({ kind: 'ready', quote });
      setDeclining(false);
    } catch (err) {
      setActionError(
        err instanceof ApiClientError && err.status === 403
          ? 'This quotation has expired. Ask your technician for a fresh one.'
          : err instanceof ApiClientError && err.status === 409
            ? 'This quotation has already been decided. Refresh to see its status.'
            : 'We couldn’t save your answer. Check your connection and try again.',
      );
    } finally {
      setBusy(null);
    }
  }

  if (state.kind === 'loading') {
    return (
      <Shell>
        <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading quotation">
          <Spinner />
        </div>
      </Shell>
    );
  }
  if (state.kind === 'missing' || state.kind === 'error') {
    return (
      <Shell>
        <h1 className="text-2xl font-bold tracking-tight">
          {state.kind === 'missing' ? 'Quotation not found' : 'Couldn’t load this quotation'}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {state.kind === 'missing'
            ? 'The link may be incomplete or the quotation was withdrawn. Ask your technician to share it again.'
            : 'Check your connection and refresh the page.'}
        </p>
      </Shell>
    );
  }

  const q = state.quote;
  const stage = quotationStage(q);

  return (
    <Shell>
      <header>
        <p className="text-sm text-muted-foreground">
          Quotation {q.number}
          {q.bookingCode ? ` · Booking ${q.bookingCode}` : ''}
        </p>
        <h1 className="mt-1 text-balance text-2xl font-bold tracking-tight sm:text-3xl">
          {q.customerFirstName ? `${q.customerFirstName}, here’s your quote` : 'Your repair quotation'}
        </h1>
      </header>

      <StageBanner stage={stage} quote={q} />

      <Card className="mt-6">
        <CardContent className="p-0">
          <h2 className="sr-only">Quoted work</h2>
          <ul className="divide-y">
            {q.lineItems.map((l, i) => (
              <li key={i} className="flex items-start justify-between gap-4 px-4 py-3 sm:px-6">
                <div className="min-w-0">
                  <p className="font-medium">{l.description}</p>
                  <p className="text-sm text-muted-foreground">
                    {l.quantity} × {formatMinorINR(l.unitPriceMinor)}
                    {l.discountMinor > 0 ? ` · ${formatMinorINR(l.discountMinor)} off` : ''}
                    {q.gstEnabled && l.taxRateBps > 0 ? ` · GST ${l.taxRateBps / 100}%` : ''}
                  </p>
                </div>
                <p className="shrink-0 font-medium tabular-nums">{formatMinorINR(l.totalMinor)}</p>
              </li>
            ))}
          </ul>
          <dl className="space-y-1 border-t px-4 py-4 text-sm sm:px-6">
            <Row label="Subtotal" value={formatMinorINR(q.subtotalMinor)} />
            {q.discountMinor > 0 ? <Row label="Discount" value={`−${formatMinorINR(q.discountMinor)}`} /> : null}
            {q.gstEnabled ? <Row label="GST" value={formatMinorINR(q.taxMinor)} /> : null}
            <div className="flex items-baseline justify-between pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="text-xl tabular-nums">{formatMinorINR(q.totalMinor)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {q.notes ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold">Notes from your technician</h2>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{q.notes}</p>
        </section>
      ) : null}

      {stage === 'awaiting' ? (
        <section className="mt-8" aria-label="Your decision">
          {actionError ? (
            <p role="alert" className="mb-3 text-sm text-danger-700 dark:text-danger-500">
              {actionError}
            </p>
          ) : null}
          {declining ? (
            <div className="space-y-3">
              <Label htmlFor={reasonId}>Reason for declining (optional)</Label>
              <textarea
                id={reasonId}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="e.g. I’d like a second opinion"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="destructive" size="lg" disabled={busy !== null} onClick={() => void decide('reject')}>
                  {busy === 'reject' ? 'Declining…' : 'Decline quotation'}
                </Button>
                <Button variant="ghost" size="lg" disabled={busy !== null} onClick={() => setDeclining(false)}>
                  Back
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="sm:flex-1" disabled={busy !== null} onClick={() => void decide('approve')}>
                {busy === 'approve' ? 'Approving…' : `Approve ${formatMinorINR(q.totalMinor)}`}
              </Button>
              <Button variant="outline" size="lg" disabled={busy !== null} onClick={() => setDeclining(true)}>
                Decline
              </Button>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Valid until {formatQuoteDate(q.expiresAt)}.</p>
        </section>
      ) : null}

      {q.terms ? (
        <section className="mt-8 border-t pt-4">
          <h2 className="text-sm font-semibold">Terms</h2>
          <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{q.terms}</p>
        </section>
      ) : null}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">{children}</div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <dt>{label}</dt>
      <dd className="tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function StageBanner({ stage, quote }: { stage: ReturnType<typeof quotationStage>; quote: PublicQuotation }) {
  if (stage === 'awaiting') {
    return (
      <p className="mt-4 text-muted-foreground">
        Review the work and price below, then approve or decline.
      </p>
    );
  }
  const view = {
    approved: {
      icon: CheckCircle2,
      badge: <Badge variant="success">Approved</Badge>,
      text: `You approved this quote${quote.approvedAt ? ` on ${formatQuoteDate(quote.approvedAt)}` : ''}. Your technician can go ahead with the work.`,
    },
    declined: {
      icon: XCircle,
      badge: <Badge variant="destructive">Declined</Badge>,
      text: 'You declined this quote. Your technician has been told; contact us if you change your mind.',
    },
    expired: {
      icon: Clock,
      badge: <Badge variant="warning">Expired</Badge>,
      text: `This quote expired on ${formatQuoteDate(quote.expiresAt)}. Ask your technician for an updated one.`,
    },
  }[stage];
  const Icon = view.icon;
  return (
    <div role="status" className="mt-4 flex items-start gap-3 rounded-lg border bg-card p-4">
      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        {view.badge}
        <p className="text-sm">{view.text}</p>
      </div>
    </div>
  );
}

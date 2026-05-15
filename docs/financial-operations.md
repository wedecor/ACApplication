# Financial Operations Module

The Financial Operations module is the financial backbone of the AC Platform —
the equivalent of Zoho Books / Tally ERP fused with field-service-specific
flows (AMCs, technician payouts, booking-anchored billing). This document is
the contract between backend, the Admin CRM, the customer / technician apps,
and accounting / ops users.

> **Philosophy.** Money is **never** a float in this codebase. Every amount is
> an integer in minor units (paise / cents) so we can audit and reconcile to
> the last paise. Display formatting lives in one place: `formatMinor()`.

---

## Module map

```
apps/api/src/
├── common/finance/                  Money math, GST splits, document numbering
├── modules/pdf/                     pdfkit-based renderers (invoice / quote / receipt / AMC)
├── modules/ledger/                  Append-only customer ledger with running balance
├── modules/invoices/                Invoice lifecycle + line items + refunds + credit notes
├── modules/quotations/              Estimate workflow + customer-facing token endpoints
├── modules/payments/                Razorpay + Stripe providers, webhook ingest, refunds
├── modules/amc/                     AMC plans, subscriptions, visit calendar, renewals
├── modules/payouts/                 Commission accrual, payout cycles, approval workflow
├── modules/finance-analytics/       KPI + chart aggregations for /dashboard/finance
├── modules/finance-events/          Cross-module orchestration (event → side-effect)
└── modules/finance-scheduler/       cron: overdue, AMC visits/renewals, weekly payouts
```

Front-end:

```
apps/admin-crm/src/
├── app/(dashboard)/finance/        Recharts KPIs + revenue / city / aging / payouts charts
├── app/(dashboard)/invoices/       List + create + detail (send / refund / record / PDF)
├── app/(dashboard)/payments/       Transaction history across providers
├── app/(dashboard)/amc/            Plans & subscriptions
├── app/(dashboard)/payouts/        Approve, mark paid
├── hooks/use-finance.ts            One file, every React Query hook
└── lib/api/{invoices,quotations,payments,amc,payouts,finance}.ts
```

---

## Domain concepts at a glance

| Concept | Stored in | Status enum | Notes |
| --- | --- | --- | --- |
| Invoice | `invoices` + `invoice_line_items` | `InvoiceStatus` | One per booking (or AMC signup, or ad-hoc). Carries CGST/SGST/IGST splits and a `pdfHash` for tamper detection. |
| Quotation | `quotations` + `quotation_line_items` | `QuotationStatus` | Has a `viewToken` for the public customer landing page. |
| Payment | `payment_transactions` + `payments` | `PaymentTransactionStatus` | Provider-agnostic shell — `payments` rows track captured money applied to invoices. |
| Refund | `refunds` | `RefundStatus` | Linked back to invoice + optional credit note. |
| Credit note | `credit_notes` | `CreditNoteStatus` | Either reduces an invoice or sits as a customer credit. |
| AMC plan | `amc_plans` | — | Catalogue: visits, cadence, price, GST handling. |
| AMC subscription | `amc_subscriptions` | `AMCSubscriptionStatus` | Per-customer instance, with `visitsScheduled / visitsCompleted` counters. |
| AMC visit | `amc_visits` | `AMCVisitStatus` | Each scheduled service. Materialises into a `Booking` 24 h before the visit. |
| Commission | `technician_commissions` | `CommissionStatus` | One per booking accrual. |
| Payout | `technician_payouts` | `PayoutStatus` | Aggregates many commissions into one transfer. |
| Ledger entry | `customer_ledger_entries` | — | Append-only. `runningBalanceMinor` is the customer's balance after each entry. |

---

## Money math (`common/finance/`)

`money.ts` is the single source of truth for arithmetic:

- `ensureInteger(value)` — every public function defends against floats.
- `sumMinor(values)` — type-safe `reduce`.
- `roundHalfEven(value)` — banker's rounding, used for tax math per GST guidance.
- `applyBps(baseMinor, bps)` — bps because we never store percentages as floats.
- `subtractFloorZero(a, b)` — discount-but-not-below-zero.
- `formatMinor(value, { currency, locale })` — display only.

`gst.ts` produces:

- `computeLineTax(line, ctx)` → `{ subtotal, tax, total, cgst, sgst, igst }` —
  intra-state splits 50/50 and re-derives each side to avoid 1-paise drift.
- `computeInvoiceTotals(lines, ctx, discount)` aggregates lines and applies
  an invoice-level discount.

`numbering.ts` produces monotonically-increasing, **gap-free**, tenant-scoped
document numbers using Postgres advisory locks inside a Prisma transaction.
Used for `INV-{yyyy}-{seq}`, `QUO-…`, `AMC-…`, etc.

---

## Invoice lifecycle

```
            send                          payment(s)              refund
DRAFT ─────────────► SENT ────────────► PARTIALLY_PAID ─────► PAID ─────► REFUNDED
   │                  │                  │                       │
   │                  └─ overdue ─► OVERDUE                       └─ cancel ─► CANCELLED
   └─ cancel ─► CANCELLED
```

Programmatic entry points:

- `InvoicesService.createFromBooking(actor, bookingId, opts)` — invoked when
  ops marks a booking complete or when a quote is converted.
- `InvoicesService.createFromLineItems(actor, customerId, lines, opts)` —
  ad-hoc invoices and AMC signup invoices.
- `InvoicesService.send(actor, id)` — fires `InvoiceSent` (→ notifications →
  WhatsApp/Email).
- `InvoicesService.applyPayment(tx, input)` — pure function over a Prisma
  transaction. Caller is responsible for opening the tx; this lets the
  webhook ingestion path stay atomic across `payment_transactions`,
  `payments`, `invoices`, and `customer_ledger_entries`.
- `InvoicesService.refund(actor, id, dto)` — produces a `refunds` row and
  optionally a `credit_notes` row when `dto.creditNote === true`.

> **Idempotency.** Payment application is keyed by
> `(invoiceId, paymentTransactionId)`. The ledger entry uses an
> `externalRef` to dedupe (e.g. `pmt:<paymentId>`), so even a retried
> webhook leaves the ledger consistent.

---

## Quotation workflow

```
            send                            view (customer)        approve
DRAFT ────────────► SENT ─────────────────► VIEWED ─────────────► APPROVED ───► CONVERTED
   │                  │                       │                       │
   │                  └─ cron expire ─► EXPIRED                       └─ reject ─► REJECTED
   └─ cancel ─► CANCELLED
```

The customer never logs in; they receive a URL with a `viewToken` which the
public endpoints accept. View → approve → reject all happen unauthenticated
behind that token, so we keep the token cryptographically random and rotate
it on quotation send.

`POST /quotations/:id/convert` writes a new `Invoice` row inside a transaction
and links it back via `convertedInvoiceId`. The cron `expireQuotations()`
flips `SENT` quotes past `expiresAt` to `EXPIRED` and emits
`QuotationExpired`.

---

## Payments

Provider abstraction lives at
`modules/payments/providers/payment-provider.interface.ts`. Each provider
implements:

```ts
interface PaymentProvider {
  name: 'razorpay' | 'stripe' | 'manual';
  createPaymentLink(input): Promise<CreatePaymentLinkResult>;
  verifyWebhookSignature(rawBody: string, signature: string | undefined): void;
  parseWebhookEvent(payload: unknown): WebhookEvent;
  issueRefund(input): Promise<IssueRefundResult>;
}
```

### Webhook security

- **Razorpay** uses HMAC-SHA256(rawBody, secret) → hex, then `timingSafeEqual`.
- **Stripe** uses the Stripe SDK `webhooks.constructEvent()` which itself does
  timing-safe verification.

To get the raw body, we boot Fastify with `{ rawBody: true }` (see `main.ts`)
and the payments controller reads `req.rawBody` for webhook routes.

### Webhook → invoice flow

1. Verify signature → `ConflictException` on mismatch (we ack to prevent
   replays, but mark the txn `FAILED` with `failureReason`).
2. Idempotently upsert the `PaymentTransaction` row keyed by
   `(provider, paymentRef)`.
3. If `event.type === 'payment.captured'` →
   `prisma.$transaction(applyPayment)` to:
   - Insert a `Payment` row (the money "applied to invoice").
   - Update `invoice.amountPaidMinor`, `dueAmountMinor`, `status`.
   - Post a ledger entry (`PAYMENT_RECEIVED`, CREDIT).
4. Emit `PaymentSucceeded` + `InvoicePaid` / `InvoicePartiallyPaid` per the
   resulting invoice state.

---

## AMC

### Plans

`AmcPlansService` is a thin CRUD; the seeded `AMCPlan`s in
`packages/database/src/seed/index.ts` show the canonical shape (`Basic`,
`Standard`, `Premium`, `Custom`).

### Subscriptions

`AmcSubscriptionsService.subscribe()`:

1. Creates the subscription in `PENDING_PAYMENT`.
2. Raises a draft invoice for the plan price (via `InvoicesService`).
3. Returns `{ subscription, invoice }` to the caller.

When that invoice is paid → `InvoicePaid` is emitted →
`FinanceEventsListener.onInvoicePaid` calls
`onSubscriptionInvoicePaid(subId)` → status flips to ACTIVE and
`generateVisitsForSubscription()` seeds the visit calendar
(one row per included visit at the plan's cadence).

### Daily crons

- `materialiseImminentVisits` (every 4 h): turns SCHEDULED visits whose
  `scheduledFor < now + 24h` into actual `Booking` rows so dispatch can
  assign technicians.
- `amcRenewalSweep` (08:00): emits `AmcSubscriptionExpiringSoon` 14 / 7 / 1
  days before expiry, and creates a renewal invoice 7 days out for
  `autoRenew` subscriptions.
- `amcMissedVisitSweep` (09:00): visits stale by > 48 h are flagged
  `MISSED`.

---

## Technician payouts

```
Booking COMPLETED ─► commission accrual ─► PAYOUT (PENDING)
                                         │
                                         ├─ approve ──► APPROVED ─► mark-paid ─► PAID
                                         │
                                         └─ fail   ──► FAILED
```

`PayoutsService`:

- `upsertRule(actor, technicianId, rule)` — `{ type, valueMinor, bonus, … }`.
  `type` is one of `PERCENTAGE | FLAT | PER_JOB`.
- `accrueForBooking(bookingId)` — called from `FinanceEventsListener` on every
  `BookingCompleted`. Idempotent — a second event over the same booking is a
  no-op because each row is unique on `bookingId`.
- `createPayout(actor, dto)` — aggregates ACCRUED + ADJUSTED commissions in
  the period into one `TechnicianPayout` row. Updates each commission's
  `payoutId`.
- `approve(actor, id, dto)` / `markPaid(actor, id, dto)` / `fail(actor, id, reason)`.
- A weekly cron auto-closes cycles for technicians whose `payoutCycle` is
  `WEEKLY`.

---

## Customer ledger

`LedgerService.post(input)` is the only legal way to write a ledger entry.
It runs inside a Prisma transaction and:

1. Optionally dedupes by `externalRef` (idempotency).
2. Reads the most-recent entry for the customer under a `SELECT … FOR
   UPDATE` row-lock.
3. Computes the new `runningBalanceMinor` and inserts the row.

Convenience helpers:

- `LedgerService.currentBalance(customerId)` — O(1) from the latest row.
- `LedgerService.statement(customerId, opts)` — paginated, with optional
  date window. Powers the customer-detail "Statement" tab and the
  downloadable PDF statement.

---

## Notifications

`NotificationListener` listens on the domain bus and dispatches templates:

| Event | Template | Channels |
| --- | --- | --- |
| InvoiceSent | `invoice.generated` | WhatsApp + Email + SMS |
| InvoicePaid | `payment.success` | WhatsApp + Email + Push |
| InvoicePartiallyPaid | `payment.partial` | WhatsApp + Push |
| PaymentFailed | `payment.failed` | WhatsApp + SMS + Push |
| InvoiceOverdue | `invoice.overdue` | WhatsApp + SMS + Email |
| QuotationApproved | `quotation.approved` | WhatsApp + Email |
| AmcSubscriptionExpiringSoon | `amc.renewal_reminder` | WhatsApp + Email + SMS |
| AmcSubscriptionRenewed | `amc.renewal_invoice` | WhatsApp + Email |

Failures are logged but never re-thrown (best-effort).

---

## Realtime

`RealtimeGateway` adds dedicated rooms for finance:

- `finance:global` — every Admin CRM finance dashboard subscribes here.
- `finance:payouts` — payout-approver-only feed.
- `invoice:{invoiceId}` — invoice detail page.
- `amc:{subscriptionId}` — AMC detail page.

Emitted finance events: `InvoiceSent`, `InvoicePaid`, `PaymentSucceeded`,
`PaymentRefunded`, `AmcSubscriptionActivated`, `AmcSubscriptionRenewed`,
`PayoutApproved`, `PayoutPaid`.

---

## RBAC

New permissions (see `packages/types/src/enums/index.ts`):

| Permission | Roles that have it (default seed) |
| --- | --- |
| `invoice.view`, `invoice.create`, `invoice.send`, `invoice.refund` | Admin, Call-center agent (view+create+send), Dispatcher (view) |
| `payment.view`, `payment.manage` | Admin, Dispatcher (view) |
| `amc.view`, `amc.manage` | Admin, Call-center agent (view+manage) |
| `payout.view`, `payout.approve`, `payout.process` | Admin |
| `finance.view` (umbrella) | Admin, Super Admin |

Customers can read their own invoices / quotations / AMCs via the public
token routes; they never need a JWT-bound permission.

---

## API surface

```
POST   /invoices                       create
GET    /invoices                       list (q, status, customerId, overdueOnly)
GET    /invoices/:id                   detail (with line items, payments)
PATCH  /invoices/:id                   update (draft only)
POST   /invoices/:id/send              transition to SENT
POST   /invoices/:id/cancel            transition to CANCELLED
POST   /invoices/:id/payments          record manual payment
POST   /invoices/:id/refund            issue refund (+optional credit note)
POST   /invoices/:id/duplicate         clone as new draft
GET    /invoices/:id/download-pdf      stream PDF

POST   /quotations                     create
GET    /quotations                     list
GET    /quotations/:id                 detail
POST   /quotations/:id/send            transition to SENT
POST   /quotations/:id/convert         convert to invoice
GET    /quotations/:id/download-pdf
GET    /quotations/public/:token       customer view
POST   /quotations/public/:token/approve
POST   /quotations/public/:token/reject

POST   /payments/create-link           Razorpay or Stripe
POST   /payments/webhook/razorpay      public
POST   /payments/webhook/stripe        public
GET    /payments/history               filterable txn audit
POST   /payments/refund/:paymentId

POST   /amc/plans                      create plan
GET    /amc/plans
PATCH  /amc/plans/:id
POST   /amc/subscriptions              subscribe + draft invoice
GET    /amc/subscriptions
GET    /amc/subscriptions/:id
POST   /amc/subscriptions/:id/cancel
POST   /amc/subscriptions/:id/generate-visits
POST   /amc/subscriptions/:id/download-contract

PATCH  /payouts/rules/:technicianId    upsert commission rule
PATCH  /payouts/commissions/:id/adjust
POST   /payouts/commissions/:id/reverse
POST   /payouts                        create payout for technician+period
GET    /payouts                        list (status, technician)
GET    /payouts/pending/:technicianId
GET    /payouts/:id
POST   /payouts/:id/approve
POST   /payouts/:id/mark-paid
POST   /payouts/:id/fail

GET    /finance/overview               headline KPIs
GET    /finance/revenue-series         daily revenue/collected/tax
GET    /finance/top-customers
GET    /finance/revenue-by-city
GET    /finance/aging
GET    /finance/payout-pipeline
GET    /ledger/customer/:id/statement
```

---

## Configuration

`apps/api/.env`:

```
# Payments
RAZORPAY_KEY_ID=rzp_test_…
RAZORPAY_KEY_SECRET=…
RAZORPAY_WEBHOOK_SECRET=whsec_…
STRIPE_SECRET_KEY=sk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…

# GST
GST_HOME_STATE=KA           # Supplier state code (for intra/inter-state)

# PDFs
PDF_BRAND_NAME="AC Platform"
PDF_BRAND_TAGLINE="Cool homes. Cooler service."
PDF_BRAND_EMAIL=hello@example.com
PDF_BRAND_PHONE="+91 …"
PDF_BRAND_GSTIN=29AAAAA…
PDF_BRAND_PRIMARY_COLOR=#1d4ed8
PDF_BRAND_ACCENT_COLOR=#10b981

# Scheduler
FINANCE_SCHEDULER_DISABLED=0   # set to 1 in unit / preview envs
```

---

## Testing

```bash
pnpm --filter @ac/api test                # all unit specs
pnpm --filter @ac/api test src/common/finance     # money + GST
pnpm --filter @ac/api test src/modules/payments   # webhook signatures
pnpm --filter @ac/api test src/modules/ledger     # running balance
pnpm --filter @ac/api test src/modules/payouts    # commission accrual
pnpm --filter @ac/api test src/modules/amc        # scheduler sweeps
pnpm --filter @ac/api test src/modules/pdf        # PDF smoke
```

Per-module coverage:

- `common/finance/__tests__/money.spec.ts` — int safety, banker's rounding, bps.
- `common/finance/__tests__/gst.spec.ts` — intra/inter-state, discount-then-tax.
- `modules/payments/__tests__/razorpay.provider.spec.ts` — signature verification + parse.
- `modules/ledger/__tests__/ledger.service.spec.ts` — running balance + idempotency.
- `modules/payouts/__tests__/payouts.service.spec.ts` — commission accrual + rules.
- `modules/amc/__tests__/amc-subscriptions.service.spec.ts` — visit materialisation + renewals + expiry sweep.
- `modules/pdf/__tests__/pdf.service.spec.ts` — invoice/AMC contract render smoke.

---

## Adding a new payment provider

1. Implement `PaymentProvider` (mirror `RazorpayProvider`).
2. Register the provider in `PaymentsModule` and the dispatch switch in
   `PaymentsService.providerFor()`.
3. Add a webhook route in `PaymentsController` that pulls the raw body.
4. Mirror the templates in `formatMinor(currency, …)` if the new gateway
   speaks a different currency.

## Adding a new finance event

1. Extend `DomainEventName` and add a typed `DomainEvent<…>` alias.
2. Publish from your service via `this.events.publish(name, payload)`.
3. Listen in `NotificationListener` (for customer comms) and/or
   `RealtimeGateway` (for live UI updates).
4. Update this doc.

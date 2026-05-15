# Inventory + Spare Parts ERP

The Inventory module is the field-service supply chain for the AC Platform —
warehouses, spare-parts, technician vans, vendors, procurement, transfers,
real-time alerts and analytics. Conceptually it sits between
**Zoho Inventory**, **ERPNext Stock** and bespoke field-service tools. This
document is the contract between the backend, the Admin CRM, the technician
app, dispatch operators and finance.

> **Philosophy.** Stock is **never** a derived number. Every movement —
> purchase receipt, transfer, technician issue, booking consumption, scrap
> write-off, manual adjustment — funnels through a single append-only ledger
> and a row-locked warehouse snapshot. Money on stock movements is always in
> minor units (paise) and integrates with the finance module's
> `formatMinor()` for display.

---

## Module map

```
apps/api/src/
├── common/inventory/                SKU + barcode + document-number helpers (advisory-locked)
├── modules/inventory/
│   ├── inventory-ledger.service.ts     Append-only ledger, row-lock + idempotency
│   ├── inventory-items.service.ts      Catalogue CRUD, search, valuation, adjustments
│   ├── warehouses.service.ts           Warehouses + zones
│   ├── vendors.service.ts              Vendor profiles, ratings, performance metrics
│   ├── purchase-orders.service.ts      Draft → approve → order → GRN lifecycle
│   ├── stock-transfers.service.ts      Inter-warehouse transfer state machine
│   ├── technician-inventory.service.ts Van inventory, allocation / use / return / reconcile
│   ├── booking-stock.service.ts        Reservation hooks for the booking engine
│   ├── inventory-alerts.service.ts     Alert engine + dedupe + scanners
│   ├── inventory-analytics.service.ts  Valuation, turnover, dead stock, fast movers, wastage
│   └── inventory-scheduler.service.ts  Cron: alert scans + auto-resolve
└── modules/realtime/realtime.gateway.ts   Broadcasts inventory.* events to rooms
```

Front-end:

```
apps/admin-crm/src/
├── app/(dashboard)/inventory/          Catalogue + KPIs + low-stock highlights
├── app/(dashboard)/warehouses/         Multi-location stock with zone counts
├── app/(dashboard)/vendors/            Suppliers, ratings, lifetime spend
├── app/(dashboard)/purchase-orders/    PO list + status filters
├── app/(dashboard)/transfers/          Transfer list, source → destination route
├── app/(dashboard)/inventory-alerts/   Alert centre with ack / resolve / re-scan
├── hooks/use-inventory.ts              React Query hooks (one file)
└── lib/api/inventory.ts                Typed API client
```

```
apps/technician-app/
├── app/inventory/index.tsx             Van inventory list, ack / use / return
├── app/inventory/scan.tsx              Scan-or-type SKU lookup (camera-ready)
└── src/lib/inventory-api.ts            Field-app API client
```

---

## Domain concepts at a glance

| Concept | Stored in | Status enum | Notes |
| --- | --- | --- | --- |
| Inventory item | `inventory_items` | — | Canonical SKU. Carries cost / selling / GST / barcode / QR / tracking flags. |
| Warehouse | `warehouses` + `warehouse_zones` | `WarehouseKind` | Central, branch, transit, vendor-returns or scrap. |
| Warehouse stock | `warehouse_stocks` | — | Per-(warehouse, item) snapshot — `quantity`, `reservedQuantity`, `avgCostMinor`. |
| Inventory ledger | `inventory_ledger` | `StockMovementKind` | Append-only. Every row carries `runningQuantity` / `runningReserved`. |
| Vendor | `vendors` | `VendorStatus` | Supplier profile, payment terms, performance scoring. |
| Purchase order | `purchase_orders` + `purchase_order_items` | `PurchaseOrderStatus` | DRAFT → AWAITING_APPROVAL → APPROVED → ORDERED → PARTIALLY_RECEIVED → RECEIVED. |
| Goods receipt | `goods_receipts` + `goods_receipt_items` | `GoodsReceiptStatus` | GRN — receives a PO line and posts `IN_PURCHASE` to the ledger. |
| Stock transfer | `stock_transfers` + `stock_transfer_items` | `StockTransferStatus` | REQUESTED → APPROVED → IN_TRANSIT → RECEIVED. |
| Technician allocation | `technician_inventory` | `TechnicianStockStatus` | ALLOCATED → ACKNOWLEDGED → USED → RETURNED → RECONCILED. |
| Inventory alert | `inventory_alerts` | `InventoryAlertStatus` | Dedupe-keyed, OPEN → ACKNOWLEDGED → RESOLVED (or SNOOZED). |

---

## The ledger (`inventory-ledger.service.ts`)

The ledger is the **only** way physical stock changes. Direct mutations on
`warehouse_stocks` are forbidden by convention; callers always go through
`InventoryLedgerService.post()` (or `postInTx()` when participating in a
larger transaction such as a PO receipt).

### Invariants

1. **Append-only.** Rows are never updated or deleted.
2. **Row-locked snapshots.** Each post acquires
   `SELECT id FROM warehouse_stocks WHERE … FOR UPDATE` before reading the
   prior balance — concurrent writers serialise on the (warehouse, item)
   pair.
3. **Idempotent.** `externalRef` (e.g. `po:42:line:1`, `alloc:abc:return:2`)
   is unique per tenant; re-running the same write returns `skipped: true`.
4. **Weighted average cost.** Inflows update `WarehouseStock.avgCostMinor`
   using `(oldQty·oldAvg + deltaQty·deltaUnit) / (oldQty + deltaQty)`, and
   the catalogue's `costPriceMinor` is kept loosely in sync.
5. **Domain event.** Every accepted post emits
   `inventory.stock_updated` to the realtime bus so dashboards, the alert
   scanner and analytics caches react.

### Movement kinds

```
IN_PURCHASE              GRN against a PO
IN_RETURN_VENDOR         Vendor RMA
IN_RETURN_TECHNICIAN     Unused parts back from a technician's van
IN_TRANSFER              Receive leg of an inter-warehouse transfer
IN_ADJUSTMENT            Manual stock count correction (positive)
IN_OPENING               Opening balance import

OUT_SALE                 Cash counter sale (B2C / B2B)
OUT_TRANSFER             Dispatch leg of an inter-warehouse transfer
OUT_ADJUSTMENT           Manual stock count correction (negative)
OUT_TO_TECHNICIAN        Allocation to a van
OUT_TO_BOOKING           Direct consumption against a booking (no van detour)
OUT_SCRAP                Scrapped / damaged stock

RESERVE                  Soft-hold for a booking / transfer (no physical movement)
RELEASE_RESERVE          Release a soft-hold
```

`STOCK_INFLOW_KINDS` and `STOCK_OUTFLOW_KINDS` (`@ac/types`) drive the
direction of `quantityDelta` automatically — services never have to remember
the sign.

---

## Purchase orders (`purchase-orders.service.ts`)

Lifecycle is enforced by `PURCHASE_ORDER_TRANSITIONS` from `@ac/types`:

```
DRAFT ─► AWAITING_APPROVAL ─► APPROVED ─► ORDERED ─► PARTIALLY_RECEIVED ─► RECEIVED
   │                            │                                  ▲
   └──────► CANCELLED ◄─────────┘                                  │
                                                                   └─ RECEIVED also reachable from ORDERED on a single-shot GRN.
```

PO numbers use the same advisory-lock pattern as invoices —
`nextInventoryNumber(prefix='PO', table='purchaseOrder')` guarantees
gap-free, year-bucketed `PO-YYYY-000001` series per tenant. GRNs follow
`GRN-YYYY-000001` and transfers `TRN-YYYY-000001`.

The GRN endpoint creates a `GoodsReceipt` + `GoodsReceiptItem` rows,
delegates each line to the ledger as an `IN_PURCHASE` movement (recording
the actual landed cost from the GRN, not the PO unit price), and rolls the
PO to `PARTIALLY_RECEIVED` / `RECEIVED` based on outstanding quantities.
`Vendor.lifetimeSpendMinor` and `onTimeRate` are updated on each GRN.

PDF rendering reuses `apps/api/src/modules/pdf` patterns; PO documents are
queued from the controller and persisted in `PurchaseOrder.pdfUrl`.

---

## Stock transfers (`stock-transfers.service.ts`)

Inter-warehouse transfers are a four-state machine:

```
REQUESTED ─► APPROVED ─► IN_TRANSIT ─► RECEIVED
    │           │
    └───────────┴── CANCELLED / REJECTED
```

| Step | Ledger effect on source | Ledger effect on destination |
| --- | --- | --- |
| `APPROVED` | `RESERVE` requested qty | none |
| `IN_TRANSIT` | `OUT_TRANSFER` + `RELEASE_RESERVE` | none |
| `RECEIVED` | none | `IN_TRANSFER` using the **destination's** received qty |

If `receivedQty < dispatchedQty` we record a transfer-level note and raise
a `TECHNICIAN_MISMATCH`-style alert so the discrepancy lands on the alert
centre rather than vanishing.

The Postgres column `WarehouseStock.lastMovementAt` is touched on every
write so the dead-stock / slow-moving scanners stay accurate.

---

## Technician inventory (`technician-inventory.service.ts`)

The van inventory is the heart of field-service auditability. Each
allocation row is a mini-ledger:

```
ALLOCATED ─► ACKNOWLEDGED ─► USED ─► RETURNED ─► RECONCILED
```

| Step | Effect |
| --- | --- |
| **Allocate** | `OUT_TO_TECHNICIAN` posted on the source warehouse. `unitCostMinor` is snapshotted. |
| **Acknowledge** | No ledger row. Just timestamps the tech's confirmation — used by alerts for "pending ack > N minutes". |
| **Use** | `usedQty` bumped on the row. A zero-quantity `OUT_TO_BOOKING` trace row is written so the booking has a paper trail back to the technician + part. |
| **Return** | `IN_RETURN_TECHNICIAN` posted on the source warehouse. `returnedQty` bumped. |
| **Reconcile** | Closes the row. If `usedQty + returnedQty < allocatedQty`, raises an `inventory_alerts` row with `kind=TECHNICIAN_MISMATCH` and severity `WARNING`. |

Booking integration: `BookingStockService.consumeFromTechnician()` is the
hook used by `BookingsService.markComplete()` to materialise on-job usage
as a `recordUsage()` call, keeping the field-app and the back-office in
sync.

---

## Booking + invoice integration (`booking-stock.service.ts`)

Three entry points the booking engine calls without ever importing the
inventory internals:

- `reserveForBooking(bookingId, items)` — posts `RESERVE` movements when a
  booking is confirmed.
- `releaseForBooking(bookingId)` — `RELEASE_RESERVE` when the booking is
  cancelled or rescheduled. Idempotent on the booking id.
- `consumeFromTechnician(bookingId, technicianId, allocations)` — invoked
  on `booking.completed`. Records usage on each allocation, which then
  syncs invoice line items via the existing invoice generator.

The `externalRef` keys are `bk:<bookingId>:reserve:<itemId>` and
`bk:<bookingId>:consume:<technicianAllocationId>` so retries and webhooks
never double-count.

---

## Alerts (`inventory-alerts.service.ts`)

Open alerts dedupe on `(kind, scope)` keys, e.g.:

| Kind | Dedupe key |
| --- | --- |
| `LOW_STOCK` | `low_stock:<warehouseId>:<itemId>` |
| `OUT_OF_STOCK` | `out_of_stock:<warehouseId>:<itemId>` |
| `EXPIRING_SOON` / `EXPIRED` | `expiring_soon:<warehouseId>:<itemId>` |
| `SLOW_MOVING` / `DEAD_STOCK` | `slow_moving:<warehouseId>:<itemId>` |
| `PENDING_TRANSFER` | `pending_transfer:<transferId>` |
| `OVERDUE_PO` | `overdue_po:<purchaseOrderId>` |
| `TECHNICIAN_MISMATCH` | `alloc:<allocationId>:shortfall` |
| `NEGATIVE_STOCK` | `negative_stock:<warehouseId>:<itemId>` |

`raise()` is idempotent and self-healing: an existing **SNOOZED** alert
whose `snoozedUntil` has passed is silently re-armed to OPEN.

`InventorySchedulerService` runs four scans on cron:

- `scanLowStock` — every 15 min, walks all `warehouse_stocks`.
- `scanPendingTransfers` — hourly, looks for IN_TRANSIT > 7 days.
- `scanOverduePos` — hourly, looks for ORDERED with `expectedAt < now`.
- `autoResolveCleared` — every 15 min, closes alerts whose condition has
  cleared (stock back above reorder, transfer received, etc.).

Each raise / resolve emits `inventory.alert_raised` /
`inventory.alert_resolved` which the realtime gateway forwards to admin
rooms (`inventory:alerts` and `inventory:global`).

---

## Realtime broadcast contract

The gateway publishes inventory events to these rooms:

| Event | Rooms |
| --- | --- |
| `inventory.stock_updated` | `inventory:global`, `inventory:warehouse:<id>`, `inventory:item:<id>` |
| `inventory.alert_raised` / `…resolved` | `inventory:alerts`, `inventory:global` |
| `inventory.purchase_order_*` | `inventory:procurement`, `inventory:global` |
| `inventory.stock_transfer_*` | `inventory:transfers`, `inventory:global` |
| `inventory.technician_stock_*` | `inventory:global`, `technician:<technicianId>` |

The Admin CRM auto-joins `inventory:global` for users with
`inventory:view`; warehouse-specific rooms are gated on `warehouse:manage`
for that warehouse.

---

## Permissions

The RBAC matrix gained the following permission strings (`@ac/types`):

| Permission | Granted to (default) |
| --- | --- |
| `inventory:view` | Admin, Dispatcher, Call-centre agent, Technician |
| `inventory:manage` | Admin |
| `inventory:adjust` | Admin |
| `warehouse:view` / `warehouse:manage` | Admin, Dispatcher |
| `vendor:view` / `vendor:manage` | Admin |
| `purchase_order:view` / `purchase_order:manage` | Admin |
| `purchase_order:approve` | Admin |
| `transfer:view` / `transfer:manage` / `transfer:approve` | Admin, Dispatcher |
| `tech_inventory:view` | Admin, Dispatcher, Technician |
| `tech_inventory:allocate` | Admin, Dispatcher |
| `tech_inventory:use` / `:return` | Technician |
| `tech_inventory:reconcile` | Admin, Dispatcher |
| `inventory_alert:view` / `:manage` | Admin, Dispatcher |

The seed script (`packages/database/src/seed/index.ts`) is the source of
truth for the default-role matrix.

---

## SKUs, barcodes and document numbers (`common/inventory/codes.ts`)

- **SKUs**: `suggestSku()` produces `{TYPE}-{BRAND}-{NAME}` from the
  catalogue entry and resolves collisions by suffixing `-N` until free
  (bounded loop, fallback to a random suffix).
- **Barcodes**: `makeEan13()` computes the standard EAN-13 checksum.
  `deriveTenantBarcode()` mints an in-house GS1 in-store-use barcode
  deterministically from `(tenantId, itemId)` — every replay produces the
  same code so reprints stay stable.
- **Document numbers**: `nextInventoryNumber()` is a thin wrapper around
  `pg_advisory_xact_lock` that yields gap-free, year-bucketed `PO-YYYY-…`,
  `GRN-YYYY-…`, `TRN-YYYY-…` strings per tenant.

---

## Testing

| Suite | What it locks down |
| --- | --- |
| `inventory-ledger.service.spec.ts` | Running balance, in/out chaining, weighted avg cost, reservation rules, idempotency, event emission. |
| `inventory-alerts.service.spec.ts` | Dedupe behaviour, snooze re-arm, ack/resolve transitions, event emission. |
| `technician-inventory.service.spec.ts` | Use / return capacity checks, shortfall → alert, reconcile idempotency. |
| `codes.spec.ts` (`common/inventory/`) | EAN-13 checksum correctness + barcode determinism. |

End-to-end tests for transfers and POs are covered by integration suites
that spin up the Prisma test database; new flows reuse the
`finance-events` orchestrator harness.

---

## Operations checklist

When something goes wrong on stock numbers, this is the order to walk:

1. **Pull the ledger.** `GET /inventory/items/:id/ledger?warehouseId=…` —
   the running balance shows where the divergence happened.
2. **Cross-check the snapshot.** `WarehouseStock.lastMovementAt` should
   match the latest ledger row. If not, look for a transaction that wrote
   to the snapshot but failed to write the ledger row — should be
   impossible since both live in the same `$transaction`.
3. **Check open alerts.** `InventoryAlertsService.list({status: OPEN})`
   highlights the systemic issue (negative stock, overdue PO, etc.).
4. **For technician shortfalls** open the allocation row in
   `/dashboard/inventory` and click the linked alert — finance can then
   chargeback through the existing payouts module.
5. **Idempotent re-runs.** Every webhook / scheduler path uses
   `externalRef`, so re-running a job is always safe.

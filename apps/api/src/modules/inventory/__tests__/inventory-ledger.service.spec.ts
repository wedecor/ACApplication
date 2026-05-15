import { DomainEventName, StockMovementKind } from '@ac/types';

import type { DomainEventBus } from '../../../common/events/domain-event-bus.service';
import { InventoryLedgerService, type PostLedgerInput } from '../inventory-ledger.service';

interface Snapshot {
  id: string;
  warehouseId: string;
  itemId: string;
  quantity: number;
  reservedQuantity: number;
  avgCostMinor: number;
}

interface LedgerRow {
  id: string;
  tenantId: string;
  warehouseId: string;
  itemId: string;
  kind: StockMovementKind;
  quantityDelta: number;
  runningQuantity: number;
  runningReserved: number;
  unitCostMinor: number;
  externalRef: string | null;
}

function buildPrisma(initial: {
  items?: Array<{ id: string; tenantId: string; costPriceMinor: number }>;
  warehouses?: Array<{ id: string; tenantId: string }>;
  snapshots?: Snapshot[];
} = {}) {
  let snapshots: Snapshot[] = initial.snapshots ? [...initial.snapshots] : [];
  let ledger: LedgerRow[] = [];
  let snapshotId = snapshots.length + 1;
  let ledgerId = 1;
  const items = initial.items ?? [];
  const warehouses = initial.warehouses ?? [];

  const tx = {
    inventoryLedger: {
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: { tenantId_externalRef?: { tenantId: string; externalRef: string } };
        }) => {
          const ref = where.tenantId_externalRef;
          if (!ref) return Promise.resolve(null);
          const found = ledger.find(
            (r) => r.tenantId === ref.tenantId && r.externalRef === ref.externalRef,
          );
          return Promise.resolve(found ?? null);
        },
      ),
      create: jest.fn(({ data }: { data: Omit<LedgerRow, 'id'> }) => {
        const created: LedgerRow = { ...data, id: `led_${ledgerId++}` };
        ledger.push(created);
        return Promise.resolve({ id: created.id });
      }),
    },
    warehouseStock: {
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: { warehouseId_itemId: { warehouseId: string; itemId: string } };
        }) => {
          const k = where.warehouseId_itemId;
          const s = snapshots.find(
            (r) => r.warehouseId === k.warehouseId && r.itemId === k.itemId,
          );
          return Promise.resolve(s ?? null);
        },
      ),
      create: jest.fn(({ data }: { data: Omit<Snapshot, 'id'> & { tenantId: string } }) => {
        const created: Snapshot = {
          id: `wstk_${snapshotId++}`,
          warehouseId: data.warehouseId,
          itemId: data.itemId,
          quantity: data.quantity,
          reservedQuantity: data.reservedQuantity,
          avgCostMinor: data.avgCostMinor,
        };
        snapshots.push(created);
        return Promise.resolve(created);
      }),
      update: jest.fn(
        ({ where, data }: { where: { id: string }; data: Partial<Snapshot> }) => {
          const s = snapshots.find((r) => r.id === where.id);
          if (!s) throw new Error('snapshot not found');
          Object.assign(s, data);
          return Promise.resolve(s);
        },
      ),
    },
    inventoryItem: {
      findFirst: jest.fn(({ where }: { where: { id: string; tenantId: string } }) =>
        Promise.resolve(
          items.find((i) => i.id === where.id && i.tenantId === where.tenantId) ?? null,
        ),
      ),
      updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
    },
    warehouse: {
      findFirst: jest.fn(({ where }: { where: { id: string; tenantId: string } }) =>
        Promise.resolve(
          warehouses.find((w) => w.id === where.id && w.tenantId === where.tenantId) ?? null,
        ),
      ),
    },
    $executeRaw: jest.fn(() => Promise.resolve(1)),
  } as unknown as never;

  const client = {
    $transaction: jest.fn(async (fn: (txn: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const prisma = { client } as never;
  return { prisma, tx, getSnapshots: () => snapshots, getLedger: () => ledger };
}

function makeEvents() {
  return { publish: jest.fn() } as unknown as DomainEventBus;
}

const base: Omit<PostLedgerInput, 'kind' | 'quantity'> = {
  tenantId: 't1',
  itemId: 'item_1',
  warehouseId: 'wh_1',
};

const seed = {
  items: [{ id: 'item_1', tenantId: 't1', costPriceMinor: 1000 }],
  warehouses: [{ id: 'wh_1', tenantId: 't1' }],
};

describe('InventoryLedgerService.post — physical stock', () => {
  it('creates the warehouse snapshot on first inflow', async () => {
    const { prisma, getSnapshots, getLedger } = buildPrisma(seed);
    const svc = new InventoryLedgerService(prisma, makeEvents());

    const r = await svc.post({
      ...base,
      kind: StockMovementKind.IN_PURCHASE,
      quantity: 10,
      unitCostMinor: 1200,
    });

    expect(r.runningQuantity).toBe(10);
    expect(r.runningReserved).toBe(0);
    expect(r.skipped).toBe(false);
    expect(getSnapshots()).toHaveLength(1);
    expect(getSnapshots()[0]?.quantity).toBe(10);
    expect(getLedger()).toHaveLength(1);
    expect(getLedger()[0]?.quantityDelta).toBe(10);
  });

  it('chains in/out movements with the right running balance', async () => {
    const { prisma } = buildPrisma(seed);
    const svc = new InventoryLedgerService(prisma, makeEvents());

    const a = await svc.post({
      ...base,
      kind: StockMovementKind.IN_PURCHASE,
      quantity: 10,
      unitCostMinor: 1000,
    });
    const b = await svc.post({
      ...base,
      kind: StockMovementKind.OUT_TO_TECHNICIAN,
      quantity: 3,
    });
    const c = await svc.post({
      ...base,
      kind: StockMovementKind.IN_RETURN_TECHNICIAN,
      quantity: 1,
      unitCostMinor: 1000,
    });

    expect(a.runningQuantity).toBe(10);
    expect(b.runningQuantity).toBe(7);
    expect(c.runningQuantity).toBe(8);
  });

  it('refuses to drive on-hand negative unless allowNegative=true', async () => {
    const { prisma } = buildPrisma(seed);
    const svc = new InventoryLedgerService(prisma, makeEvents());
    await expect(
      svc.post({ ...base, kind: StockMovementKind.OUT_TO_BOOKING, quantity: 5 }),
    ).rejects.toThrow(/below zero/i);
  });

  it('weights the average cost across inflows', async () => {
    const { prisma, getSnapshots } = buildPrisma(seed);
    const svc = new InventoryLedgerService(prisma, makeEvents());
    await svc.post({
      ...base,
      kind: StockMovementKind.IN_PURCHASE,
      quantity: 10,
      unitCostMinor: 1000,
    });
    await svc.post({
      ...base,
      kind: StockMovementKind.IN_PURCHASE,
      quantity: 10,
      unitCostMinor: 1500,
    });
    expect(getSnapshots()[0]?.avgCostMinor).toBe(1250);
  });
});

describe('InventoryLedgerService.post — reservations', () => {
  it('reserves up to available stock and releases correctly', async () => {
    const { prisma, getSnapshots } = buildPrisma(seed);
    const svc = new InventoryLedgerService(prisma, makeEvents());
    await svc.post({
      ...base,
      kind: StockMovementKind.IN_PURCHASE,
      quantity: 10,
      unitCostMinor: 1000,
    });
    const r1 = await svc.post({ ...base, kind: StockMovementKind.RESERVE, quantity: 4 });
    expect(r1.runningReserved).toBe(4);
    expect(r1.runningQuantity).toBe(10);

    const r2 = await svc.post({
      ...base,
      kind: StockMovementKind.RELEASE_RESERVE,
      quantity: 2,
    });
    expect(r2.runningReserved).toBe(2);
    expect(getSnapshots()[0]?.reservedQuantity).toBe(2);
  });

  it('rejects a reservation greater than available stock', async () => {
    const { prisma } = buildPrisma(seed);
    const svc = new InventoryLedgerService(prisma, makeEvents());
    await svc.post({
      ...base,
      kind: StockMovementKind.IN_PURCHASE,
      quantity: 5,
      unitCostMinor: 1000,
    });
    await expect(
      svc.post({ ...base, kind: StockMovementKind.RESERVE, quantity: 6 }),
    ).rejects.toThrow(/insufficient/i);
  });

  it('rejects a release greater than currently reserved', async () => {
    const { prisma } = buildPrisma(seed);
    const svc = new InventoryLedgerService(prisma, makeEvents());
    await svc.post({
      ...base,
      kind: StockMovementKind.IN_PURCHASE,
      quantity: 5,
      unitCostMinor: 1000,
    });
    await expect(
      svc.post({ ...base, kind: StockMovementKind.RELEASE_RESERVE, quantity: 1 }),
    ).rejects.toThrow(/release more than/i);
  });
});

describe('InventoryLedgerService.post — idempotency & events', () => {
  it('is idempotent on externalRef', async () => {
    const { prisma, getLedger } = buildPrisma(seed);
    const svc = new InventoryLedgerService(prisma, makeEvents());
    const a = await svc.post({
      ...base,
      kind: StockMovementKind.IN_PURCHASE,
      quantity: 4,
      unitCostMinor: 1000,
      externalRef: 'po:42:line:1',
    });
    const b = await svc.post({
      ...base,
      kind: StockMovementKind.IN_PURCHASE,
      quantity: 4,
      unitCostMinor: 1000,
      externalRef: 'po:42:line:1',
    });
    expect(b.skipped).toBe(true);
    expect(b.id).toBe(a.id);
    expect(getLedger()).toHaveLength(1);
  });

  it('publishes an InventoryStockUpdated event after every accepted post', async () => {
    const { prisma } = buildPrisma(seed);
    const events = makeEvents();
    const svc = new InventoryLedgerService(prisma, events);
    await svc.post({
      ...base,
      kind: StockMovementKind.IN_PURCHASE,
      quantity: 1,
      unitCostMinor: 1000,
    });
    expect(events.publish).toHaveBeenCalledWith(
      DomainEventName.InventoryStockUpdated,
      expect.objectContaining({
        itemId: 'item_1',
        warehouseId: 'wh_1',
        quantityDelta: 1,
        runningQuantity: 1,
      }),
    );
  });
});

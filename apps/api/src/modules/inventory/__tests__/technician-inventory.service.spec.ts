import {
  DomainEventName,
  InventoryAlertKind,
  InventoryAlertSeverity,
  TechnicianStockStatus,
} from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import type { DomainEventBus } from '../../../common/events/domain-event-bus.service';
import type { InventoryLedgerService } from '../inventory-ledger.service';
import { TechnicianInventoryService } from '../technician-inventory.service';

interface AllocationRow {
  id: string;
  tenantId: string;
  technicianId: string;
  itemId: string;
  sourceWarehouseId: string;
  bookingId: string | null;
  status: TechnicianStockStatus;
  allocatedQty: number;
  usedQty: number;
  returnedQty: number;
  unitCostMinor: number;
  acknowledgedAt: Date | null;
  usedAt: Date | null;
  returnedAt: Date | null;
  reconciledAt: Date | null;
  notes: string | null;
  allocatedAt: Date;
}

interface AlertRow {
  id: string;
  tenantId: string;
  kind: string;
  severity: string;
  itemId: string;
  warehouseId: string;
  technicianId: string;
  title: string;
  observedValue: number;
  thresholdValue: number;
  dedupeKey: string;
}

function buildPrisma(initial: { allocations?: AllocationRow[] } = {}) {
  let allocations: AllocationRow[] = initial.allocations ? [...initial.allocations] : [];
  let alerts: AlertRow[] = [];
  let alertCounter = 1;

  const tx = {
    technicianInventory: {
      findFirst: jest.fn(
        ({ where }: { where: { id: string; tenantId: string } }) =>
          Promise.resolve(
            allocations.find(
              (a) => a.id === where.id && a.tenantId === where.tenantId,
            ) ?? null,
          ),
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<AllocationRow> & {
            usedQty?: { increment: number };
            returnedQty?: { increment: number };
          };
        }) => {
          const row = allocations.find((a) => a.id === where.id);
          if (!row) throw new Error('not found');
          if (data.usedQty && typeof data.usedQty === 'object' && 'increment' in data.usedQty) {
            row.usedQty += data.usedQty.increment;
            delete data.usedQty;
          }
          if (
            data.returnedQty &&
            typeof data.returnedQty === 'object' &&
            'increment' in data.returnedQty
          ) {
            row.returnedQty += data.returnedQty.increment;
            delete data.returnedQty;
          }
          Object.assign(row, data);
          return Promise.resolve(row);
        },
      ),
    },
    inventoryAlert: {
      create: jest.fn(({ data }: { data: Omit<AlertRow, 'id'> }) => {
        const created: AlertRow = { ...data, id: `alert_${alertCounter++}` };
        alerts.push(created);
        return Promise.resolve(created);
      }),
    },
  } as unknown as never;

  const client = {
    $transaction: jest.fn(async (fn: (txn: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const prisma = { client } as never;
  return {
    prisma,
    getAllocations: () => allocations,
    getAlerts: () => alerts,
  };
}

function makeEvents() {
  return { publish: jest.fn() } as unknown as DomainEventBus;
}

function makeLedger() {
  return {
    post: jest.fn(),
    postInTx: jest.fn().mockResolvedValue({
      id: 'led_x',
      runningQuantity: 0,
      runningReserved: 0,
      skipped: false,
    }),
  } as unknown as InventoryLedgerService;
}

const actor: AuthPrincipal = {
  userId: 'u_dispatcher',
  tenantId: 't1',
  roles: [],
  permissions: [],
} as unknown as AuthPrincipal;

function buildAllocation(overrides: Partial<AllocationRow> = {}): AllocationRow {
  return {
    id: 'alloc_1',
    tenantId: 't1',
    technicianId: 'tech_1',
    itemId: 'item_1',
    sourceWarehouseId: 'wh_1',
    bookingId: null,
    status: TechnicianStockStatus.ACKNOWLEDGED,
    allocatedQty: 5,
    usedQty: 0,
    returnedQty: 0,
    unitCostMinor: 1000,
    acknowledgedAt: new Date(),
    usedAt: null,
    returnedAt: null,
    reconciledAt: null,
    notes: null,
    allocatedAt: new Date(),
    ...overrides,
  };
}

describe('TechnicianInventoryService.recordUsage', () => {
  it('increments usedQty and writes a trace ledger row', async () => {
    const { prisma, getAllocations } = buildPrisma({
      allocations: [buildAllocation()],
    });
    const ledger = makeLedger();
    const svc = new TechnicianInventoryService(prisma, ledger, makeEvents());
    await svc.recordUsage(actor, 'alloc_1', { usedQty: 2 });
    expect(getAllocations()[0]?.usedQty).toBe(2);
    expect(getAllocations()[0]?.status).toBe(TechnicianStockStatus.USED);
    expect(ledger.postInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ quantity: 0, allowNegative: true }),
    );
  });

  it('refuses to record usage beyond the remaining allocation', async () => {
    const { prisma } = buildPrisma({
      allocations: [buildAllocation({ usedQty: 3, returnedQty: 1 })],
    });
    const svc = new TechnicianInventoryService(prisma, makeLedger(), makeEvents());
    await expect(
      svc.recordUsage(actor, 'alloc_1', { usedQty: 2 }),
    ).rejects.toThrow(/exceeds remaining/i);
  });
});

describe('TechnicianInventoryService.returnStock', () => {
  it('posts an IN_RETURN_TECHNICIAN ledger row and bumps returnedQty', async () => {
    const { prisma, getAllocations } = buildPrisma({
      allocations: [buildAllocation()],
    });
    const ledger = makeLedger();
    const svc = new TechnicianInventoryService(prisma, ledger, makeEvents());
    await svc.returnStock(actor, 'alloc_1', { returnedQty: 1 });
    expect(getAllocations()[0]?.returnedQty).toBe(1);
    expect(getAllocations()[0]?.status).toBe(TechnicianStockStatus.RETURNED);
    expect(ledger.postInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ quantity: 1 }),
    );
  });
});

describe('TechnicianInventoryService.reconcile', () => {
  it('raises a TECHNICIAN_MISMATCH alert when there is a shortfall', async () => {
    const { prisma, getAlerts, getAllocations } = buildPrisma({
      allocations: [buildAllocation({ usedQty: 2, returnedQty: 1 })],
    });
    const events = makeEvents();
    const svc = new TechnicianInventoryService(prisma, makeLedger(), events);
    await svc.reconcile(actor, 'alloc_1', {});
    expect(getAllocations()[0]?.status).toBe(TechnicianStockStatus.RECONCILED);
    expect(getAlerts()).toHaveLength(1);
    expect(getAlerts()[0]?.kind).toBe(InventoryAlertKind.TECHNICIAN_MISMATCH);
    expect(getAlerts()[0]?.severity).toBe(InventoryAlertSeverity.WARNING);
    expect(getAlerts()[0]?.observedValue).toBe(2);
    expect(events.publish).toHaveBeenCalledWith(
      DomainEventName.TechnicianStockReconciled,
      expect.objectContaining({ shortfallQty: 2 }),
    );
  });

  it('reconciles cleanly with zero shortfall when everything is accounted for', async () => {
    const { prisma, getAlerts } = buildPrisma({
      allocations: [buildAllocation({ usedQty: 3, returnedQty: 2 })],
    });
    const svc = new TechnicianInventoryService(prisma, makeLedger(), makeEvents());
    await svc.reconcile(actor, 'alloc_1', {});
    expect(getAlerts()).toHaveLength(0);
  });

  it('is idempotent — re-reconcile is a no-op', async () => {
    const reconciled = buildAllocation({
      status: TechnicianStockStatus.RECONCILED,
      reconciledAt: new Date(),
    });
    const { prisma, getAlerts } = buildPrisma({
      allocations: [reconciled],
    });
    const events = makeEvents();
    const svc = new TechnicianInventoryService(prisma, makeLedger(), events);
    const out = await svc.reconcile(actor, 'alloc_1', {});
    expect(out.status).toBe(TechnicianStockStatus.RECONCILED);
    expect(getAlerts()).toHaveLength(0);
    expect(events.publish).not.toHaveBeenCalled();
  });
});

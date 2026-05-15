import {
  DomainEventName,
  InventoryAlertKind,
  InventoryAlertSeverity,
  InventoryAlertStatus,
} from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import type { DomainEventBus } from '../../../common/events/domain-event-bus.service';
import { InventoryAlertsService } from '../inventory-alerts.service';

interface AlertRow {
  id: string;
  tenantId: string;
  kind: InventoryAlertKind;
  severity: InventoryAlertSeverity;
  status: InventoryAlertStatus;
  itemId: string | null;
  warehouseId: string | null;
  vendorId: string | null;
  transferId: string | null;
  purchaseOrderId: string | null;
  technicianId: string | null;
  title: string;
  observedValue: number | null;
  thresholdValue: number | null;
  dedupeKey: string;
  createdAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
  resolvedAt: Date | null;
  snoozedUntil: Date | null;
}

function buildPrisma(initial: AlertRow[] = []) {
  let rows: AlertRow[] = [...initial];
  let counter = rows.length + 1;
  const client = {
    inventoryAlert: {
      findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) => {
        const status = where.status as { in?: InventoryAlertStatus[] } | InventoryAlertStatus | undefined;
        const match = rows.find((r) => {
          if (where.id && r.id !== where.id) return false;
          if (where.tenantId && r.tenantId !== where.tenantId) return false;
          if (where.dedupeKey && r.dedupeKey !== where.dedupeKey) return false;
          if (status) {
            if (typeof status === 'object' && Array.isArray(status.in)) {
              if (!status.in.includes(r.status)) return false;
            } else if (typeof status === 'string') {
              if (r.status !== status) return false;
            }
          }
          return true;
        });
        return Promise.resolve(match ?? null);
      }),
      create: jest.fn(({ data }: { data: Partial<AlertRow> }) => {
        const created: AlertRow = {
          id: `alert_${counter++}`,
          tenantId: data.tenantId as string,
          kind: data.kind as InventoryAlertKind,
          severity: (data.severity as InventoryAlertSeverity) ?? InventoryAlertSeverity.WARNING,
          status: InventoryAlertStatus.OPEN,
          itemId: data.itemId ?? null,
          warehouseId: data.warehouseId ?? null,
          vendorId: data.vendorId ?? null,
          transferId: data.transferId ?? null,
          purchaseOrderId: data.purchaseOrderId ?? null,
          technicianId: data.technicianId ?? null,
          title: data.title as string,
          observedValue: data.observedValue ?? null,
          thresholdValue: data.thresholdValue ?? null,
          dedupeKey: data.dedupeKey as string,
          createdAt: new Date(),
          acknowledgedAt: null,
          acknowledgedBy: null,
          resolvedAt: null,
          snoozedUntil: null,
        };
        rows.push(created);
        return Promise.resolve({ id: created.id });
      }),
      update: jest.fn(({ where, data }: { where: { id: string }; data: Partial<AlertRow> }) => {
        const r = rows.find((x) => x.id === where.id);
        if (!r) throw new Error('alert not found');
        Object.assign(r, data);
        return Promise.resolve(r);
      }),
    },
  };
  const prisma = { client } as never;
  return { prisma, getRows: () => rows };
}

function makeEvents() {
  return { publish: jest.fn() } as unknown as DomainEventBus;
}

const actor: AuthPrincipal = {
  userId: 'u1',
  tenantId: 't1',
  roles: [],
  permissions: [],
} as unknown as AuthPrincipal;

describe('InventoryAlertsService.raise — dedupe', () => {
  it('creates a new alert when no open dedupe key exists', async () => {
    const { prisma, getRows } = buildPrisma();
    const events = makeEvents();
    const svc = new InventoryAlertsService(prisma, events);
    const id = await svc.raise({
      tenantId: 't1',
      kind: InventoryAlertKind.LOW_STOCK,
      severity: InventoryAlertSeverity.WARNING,
      itemId: 'i1',
      warehouseId: 'w1',
      title: 'Low stock',
      dedupeKey: 'low_stock:w1:i1',
    });
    expect(id).toMatch(/^alert_/);
    expect(getRows()).toHaveLength(1);
    expect(events.publish).toHaveBeenCalledWith(
      DomainEventName.InventoryAlertRaised,
      expect.objectContaining({ kind: InventoryAlertKind.LOW_STOCK }),
    );
  });

  it('returns the existing alert id and does not duplicate when dedupe matches', async () => {
    const { prisma, getRows } = buildPrisma();
    const events = makeEvents();
    const svc = new InventoryAlertsService(prisma, events);
    const a = await svc.raise({
      tenantId: 't1',
      kind: InventoryAlertKind.LOW_STOCK,
      itemId: 'i1',
      warehouseId: 'w1',
      title: 'Low stock',
      dedupeKey: 'low_stock:w1:i1',
    });
    const b = await svc.raise({
      tenantId: 't1',
      kind: InventoryAlertKind.LOW_STOCK,
      itemId: 'i1',
      warehouseId: 'w1',
      title: 'Low stock again',
      dedupeKey: 'low_stock:w1:i1',
    });
    expect(b).toBe(a);
    expect(getRows()).toHaveLength(1);
    // Second call must not publish a "raised" event.
    expect(events.publish).toHaveBeenCalledTimes(1);
  });

  it('re-arms a snoozed alert when the snooze window has elapsed', async () => {
    const past = new Date(Date.now() - 60_000);
    const seed: AlertRow = {
      id: 'alert_seed',
      tenantId: 't1',
      kind: InventoryAlertKind.LOW_STOCK,
      severity: InventoryAlertSeverity.WARNING,
      status: InventoryAlertStatus.SNOOZED,
      itemId: 'i1',
      warehouseId: 'w1',
      vendorId: null,
      transferId: null,
      purchaseOrderId: null,
      technicianId: null,
      title: 'Snoozed',
      observedValue: null,
      thresholdValue: null,
      dedupeKey: 'low_stock:w1:i1',
      createdAt: new Date(),
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      snoozedUntil: past,
    };
    const { prisma, getRows } = buildPrisma([seed]);
    const svc = new InventoryAlertsService(prisma, makeEvents());

    const id = await svc.raise({
      tenantId: 't1',
      kind: InventoryAlertKind.LOW_STOCK,
      itemId: 'i1',
      warehouseId: 'w1',
      title: 'Low stock',
      dedupeKey: 'low_stock:w1:i1',
    });
    expect(id).toBe('alert_seed');
    expect(getRows()[0]?.status).toBe(InventoryAlertStatus.OPEN);
    expect(getRows()[0]?.snoozedUntil).toBeNull();
  });
});

describe('InventoryAlertsService.acknowledge / resolve', () => {
  it('moves OPEN → ACKNOWLEDGED on acknowledge', async () => {
    const seed: AlertRow = {
      id: 'a1',
      tenantId: 't1',
      kind: InventoryAlertKind.LOW_STOCK,
      severity: InventoryAlertSeverity.WARNING,
      status: InventoryAlertStatus.OPEN,
      itemId: null,
      warehouseId: null,
      vendorId: null,
      transferId: null,
      purchaseOrderId: null,
      technicianId: null,
      title: 't',
      observedValue: null,
      thresholdValue: null,
      dedupeKey: 'k',
      createdAt: new Date(),
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      snoozedUntil: null,
    };
    const { prisma, getRows } = buildPrisma([seed]);
    const svc = new InventoryAlertsService(prisma, makeEvents());
    await svc.acknowledge(actor, 'a1');
    expect(getRows()[0]?.status).toBe(InventoryAlertStatus.ACKNOWLEDGED);
    expect(getRows()[0]?.acknowledgedBy).toBe('u1');
  });

  it('moves to RESOLVED on resolve and emits an event', async () => {
    const seed: AlertRow = {
      id: 'a2',
      tenantId: 't1',
      kind: InventoryAlertKind.LOW_STOCK,
      severity: InventoryAlertSeverity.WARNING,
      status: InventoryAlertStatus.OPEN,
      itemId: null,
      warehouseId: null,
      vendorId: null,
      transferId: null,
      purchaseOrderId: null,
      technicianId: null,
      title: 't',
      observedValue: null,
      thresholdValue: null,
      dedupeKey: 'k2',
      createdAt: new Date(),
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      snoozedUntil: null,
    };
    const { prisma, getRows } = buildPrisma([seed]);
    const events = makeEvents();
    const svc = new InventoryAlertsService(prisma, events);
    await svc.resolve(actor, 'a2');
    expect(getRows()[0]?.status).toBe(InventoryAlertStatus.RESOLVED);
    expect(events.publish).toHaveBeenCalledWith(
      DomainEventName.InventoryAlertResolved,
      { alertId: 'a2' },
    );
  });
});

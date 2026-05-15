import { LedgerEntryDirection, LedgerEntryType } from '@ac/types';

import { LedgerService } from '../ledger.service';

interface LedgerRow {
  id: string;
  customerId: string;
  externalRef: string | null;
  direction: LedgerEntryDirection;
  amountMinor: number;
  runningBalanceMinor: number;
  occurredAt: Date;
}

function buildPrisma(initial: LedgerRow[] = []) {
  let rows = [...initial];
  let idCounter = rows.length + 1;
  const tx = {
    customerLedgerEntry: {
      findUnique: jest.fn(({ where }: { where: { customerId_externalRef?: { customerId: string; externalRef: string } } }) => {
        const ref = where.customerId_externalRef;
        if (!ref) return null;
        const found = rows.find((r) => r.customerId === ref.customerId && r.externalRef === ref.externalRef);
        return Promise.resolve(found ?? null);
      }),
      create: jest.fn(({ data }: { data: Omit<LedgerRow, 'id'> }) => {
        const created: LedgerRow = { ...data, id: `entry_${idCounter++}` };
        rows.push(created);
        return Promise.resolve(created);
      }),
      findMany: jest.fn(() => Promise.resolve([...rows])),
    },
    $queryRaw: jest.fn(() => {
      const sorted = [...rows].sort(
        (a, b) =>
          b.occurredAt.getTime() - a.occurredAt.getTime() ||
          b.id.localeCompare(a.id),
      );
      return Promise.resolve(sorted.length > 0 ? [{ runningBalanceMinor: sorted[0].runningBalanceMinor }] : []);
    }),
  } as unknown as never;

  const client = {
    $transaction: jest.fn(async (fn: (txn: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const prisma = { client } as never;
  return { prisma, tx, getRows: () => rows };
}

describe('LedgerService.post — running balance', () => {
  it('starts at 0 + delta for the first entry', async () => {
    const { prisma } = buildPrisma();
    const svc = new LedgerService(prisma);
    const r = await svc.post({
      tenantId: 't1',
      customerId: 'c1',
      entryType: LedgerEntryType.INVOICE_ISSUED,
      direction: LedgerEntryDirection.DEBIT,
      amountMinor: 1000,
      description: 'Invoice INV-1',
    });
    expect(r.runningBalanceMinor).toBe(1000);
    expect(r.skipped).toBe(false);
  });

  it('chains debits and credits correctly', async () => {
    const { prisma } = buildPrisma();
    const svc = new LedgerService(prisma);
    const a = await svc.post({
      tenantId: 't1',
      customerId: 'c1',
      entryType: LedgerEntryType.INVOICE_ISSUED,
      direction: LedgerEntryDirection.DEBIT,
      amountMinor: 5000,
      description: 'Invoice',
    });
    const b = await svc.post({
      tenantId: 't1',
      customerId: 'c1',
      entryType: LedgerEntryType.PAYMENT_RECEIVED,
      direction: LedgerEntryDirection.CREDIT,
      amountMinor: 2000,
      description: 'Partial payment',
    });
    const c = await svc.post({
      tenantId: 't1',
      customerId: 'c1',
      entryType: LedgerEntryType.PAYMENT_RECEIVED,
      direction: LedgerEntryDirection.CREDIT,
      amountMinor: 3000,
      description: 'Final payment',
    });
    expect(a.runningBalanceMinor).toBe(5000);
    expect(b.runningBalanceMinor).toBe(3000);
    expect(c.runningBalanceMinor).toBe(0);
  });

  it('is idempotent on externalRef', async () => {
    const { prisma } = buildPrisma();
    const svc = new LedgerService(prisma);
    const first = await svc.post({
      tenantId: 't1',
      customerId: 'c1',
      entryType: LedgerEntryType.PAYMENT_RECEIVED,
      direction: LedgerEntryDirection.CREDIT,
      amountMinor: 1000,
      description: 'webhook',
      externalRef: 'whk_42',
    });
    const second = await svc.post({
      tenantId: 't1',
      customerId: 'c1',
      entryType: LedgerEntryType.PAYMENT_RECEIVED,
      direction: LedgerEntryDirection.CREDIT,
      amountMinor: 1000,
      description: 'webhook',
      externalRef: 'whk_42',
    });
    expect(second.id).toBe(first.id);
    expect(second.skipped).toBe(true);
  });
});

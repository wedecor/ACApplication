import { allocateDocumentNumber, formatDocumentNumber, sequenceFromNumber } from '../document-sequence';

function buildPrisma(latest: string | null, counterValue?: number) {
  const findFirst = jest.fn().mockResolvedValue(latest ? { number: latest } : null);
  // The real upsert returns the seed for a new row, or the bumped counter.
  const queryRaw = jest.fn(async (_sql: TemplateStringsArray, ...values: unknown[]) => [
    { lastValue: counterValue ?? (values[3] as number) },
  ]);
  const tx = { invoice: { findFirst }, $queryRaw: queryRaw };
  const prisma = { client: { $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) } };
  return { prisma, findFirst, queryRaw };
}

describe('sequenceFromNumber', () => {
  it('reads the counter after the window prefix', () => {
    expect(sequenceFromNumber('INV-2026-000041', 'INV-2026-')).toBe(41);
  });

  it('returns 0 for a missing, foreign or malformed number', () => {
    expect(sequenceFromNumber(null, 'INV-2026-')).toBe(0);
    expect(sequenceFromNumber('INV-2025-000041', 'INV-2026-')).toBe(0);
    expect(sequenceFromNumber('INV-2026-abc', 'INV-2026-')).toBe(0);
  });
});

describe('formatDocumentNumber', () => {
  it('zero-pads to the requested width', () => {
    expect(formatDocumentNumber('QTN', 2026, 7)).toBe('QTN-2026-000007');
    expect(formatDocumentNumber('PO', 2026, 12, 4)).toBe('PO-2026-0012');
  });
});

describe('allocateDocumentNumber', () => {
  it('seeds a new counter from the highest stored number, scoped to the tenant', async () => {
    const { prisma, findFirst, queryRaw } = buildPrisma('INV-2026-000041');
    await expect(
      allocateDocumentNumber(prisma as never, 'tenant_1', { prefix: 'INV', table: 'invoice', year: 2026 }),
    ).resolves.toBe('INV-2026-000042');
    expect(findFirst.mock.calls[0][0].where).toEqual({ tenantId: 'tenant_1', number: { startsWith: 'INV-2026-' } });
    expect(queryRaw.mock.calls[0]!.slice(1)).toEqual(['tenant_1', 'INV', 2026, 42]);
  });

  it('uses the value the counter returns, so concurrent callers get distinct numbers', async () => {
    // Another request already took 42; the upsert bumps the row to 43.
    const { prisma } = buildPrisma('INV-2026-000041', 43);
    await expect(
      allocateDocumentNumber(prisma as never, 'tenant_1', { prefix: 'INV', table: 'invoice', year: 2026 }),
    ).resolves.toBe('INV-2026-000043');
  });

  it('upserts atomically and never moves the counter below existing rows', async () => {
    const { prisma, queryRaw } = buildPrisma(null);
    await allocateDocumentNumber(prisma as never, 'tenant_1', { prefix: 'INV', table: 'invoice', year: 2026 });
    const sql = queryRaw.mock.calls[0]![0].join('?');
    expect(sql).toContain('ON CONFLICT ("tenantId", "prefix", "year") DO UPDATE');
    expect(sql).toContain('GREATEST');
    expect(sql).toContain('RETURNING "lastValue"');
  });
});

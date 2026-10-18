import { nextSupportNumber } from '../numbering';

function buildPrisma(latestNumber: string | null) {
  const findFirst = jest.fn().mockResolvedValue(
    latestNumber ? { number: latestNumber } : null,
  );
  // Echo the seed back, as the INSERT … ON CONFLICT does for a new counter row.
  const queryRaw = jest.fn(async (_sql: TemplateStringsArray, ...values: unknown[]) => [
    { lastValue: values[3] as number },
  ]);
  const tx = {
    supportTicket: { findFirst },
    callLog: { findFirst },
    $queryRaw: queryRaw,
  };
  const prisma = {
    client: {
      $transaction: jest.fn(async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx)),
    },
  };
  return { prisma, findFirst, queryRaw };
}

describe('nextSupportNumber', () => {
  it('starts at 000001 when there is no prior row', async () => {
    const { prisma } = buildPrisma(null);
    const out = await nextSupportNumber(prisma as never, 'tenant_x', {
      prefix: 'TKT',
      table: 'supportTicket',
      year: 2025,
    });
    expect(out).toBe('TKT-2025-000001');
  });

  it('increments from the latest sequential value', async () => {
    const { prisma } = buildPrisma('TKT-2025-000042');
    const out = await nextSupportNumber(prisma as never, 'tenant_x', {
      prefix: 'TKT',
      table: 'supportTicket',
      year: 2025,
    });
    expect(out).toBe('TKT-2025-000043');
  });

  it('allocates through the atomic per-tenant counter', async () => {
    const { prisma, queryRaw } = buildPrisma(null);
    await nextSupportNumber(prisma as never, 'tenant_x', {
      prefix: 'CALL',
      table: 'callLog',
      year: 2025,
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(queryRaw.mock.calls[0][0].join('?')).toContain('ON CONFLICT');
    expect(queryRaw.mock.calls[0].slice(1, 5)).toEqual(['tenant_x', 'CALL', 2025, 1]);
  });

  it('throws when the model name is unknown', async () => {
    const { prisma } = buildPrisma(null);
    await expect(
      nextSupportNumber(prisma as never, 'tenant_x', {
        prefix: 'TKT',
        // @ts-expect-error — testing the defensive branch.
        table: 'invalid',
      }),
    ).rejects.toThrow(/Unknown numbering model/);
  });
});

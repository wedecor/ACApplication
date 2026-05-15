import { nextSupportNumber } from '../numbering';

function buildPrisma(latestNumber: string | null) {
  const findFirst = jest.fn().mockResolvedValue(
    latestNumber ? { number: latestNumber } : null,
  );
  const executeRawUnsafe = jest.fn().mockResolvedValue(0);
  const tx = {
    supportTicket: { findFirst },
    callLog: { findFirst },
    $executeRawUnsafe: executeRawUnsafe,
  };
  const prisma = {
    client: {
      $transaction: jest.fn(async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx)),
    },
  };
  return { prisma, findFirst, executeRawUnsafe };
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

  it('takes an advisory lock before reading the latest row', async () => {
    const { prisma, executeRawUnsafe } = buildPrisma(null);
    await nextSupportNumber(prisma as never, 'tenant_x', {
      prefix: 'CALL',
      table: 'callLog',
      year: 2025,
    });
    expect(executeRawUnsafe).toHaveBeenCalledTimes(1);
    expect(executeRawUnsafe.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
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

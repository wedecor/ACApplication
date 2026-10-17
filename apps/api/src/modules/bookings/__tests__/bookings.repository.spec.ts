import { BookingsRepository } from '../bookings.repository';

const HOUR = 60 * 60 * 1000;

function buildRepo(found: unknown = null) {
  const prisma = {
    client: { booking: { findFirst: jest.fn().mockResolvedValue(found) } },
  };
  return { repo: new BookingsRepository(prisma as never), prisma };
}

describe('BookingsRepository.hasTechnicianConflict', () => {
  const at = new Date('2026-10-20T10:00:00.000Z');

  it('queries a +/-2h window over in-flight statuses, excluding soft-deleted rows', async () => {
    const { repo, prisma } = buildRepo();
    await repo.hasTechnicianConflict({ technicianId: 'tech_1', scheduledAt: at });
    const { where } = prisma.client.booking.findFirst.mock.calls[0]![0];
    expect(where).toEqual(
      expect.objectContaining({
        technicianId: 'tech_1',
        deletedAt: null,
        scheduledAt: {
          gte: new Date(at.getTime() - 2 * HOUR),
          lt: new Date(at.getTime() + 2 * HOUR),
        },
      }),
    );
    expect([...where.status.in].sort()).toEqual(
      ['ASSIGNED', 'IN_PROGRESS', 'TECHNICIAN_EN_ROUTE', 'WAITING_PARTS'].sort(),
    );
    expect(where.NOT).toBeUndefined();
  });

  it('excludes the booking being moved', async () => {
    const { repo, prisma } = buildRepo();
    await repo.hasTechnicianConflict({
      technicianId: 'tech_1',
      scheduledAt: at,
      excludeBookingId: 'book_1',
    });
    expect(prisma.client.booking.findFirst.mock.calls[0]![0].where).toEqual(
      expect.objectContaining({ NOT: { id: 'book_1' } }),
    );
  });

  it('returns true when a clashing booking exists', async () => {
    const { repo } = buildRepo({ id: 'other' });
    await expect(repo.hasTechnicianConflict({ technicianId: 't', scheduledAt: at })).resolves.toBe(true);
  });

  it('returns false when nothing clashes', async () => {
    const { repo } = buildRepo(null);
    await expect(repo.hasTechnicianConflict({ technicianId: 't', scheduledAt: at })).resolves.toBe(false);
  });
});

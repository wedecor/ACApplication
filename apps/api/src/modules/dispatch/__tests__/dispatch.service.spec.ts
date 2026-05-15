import { ConflictException } from '@nestjs/common';
import { BookingPriority, DispatchAlertKind, DispatchDecision, ServiceCategory } from '@ac/types';

import { DispatchService } from '../dispatch.service';

/**
 * Unit tests for the smart dispatch engine.
 *
 * We mock the AssignmentService (raw scoring), RoutingService (ETA) and
 * BookingsService (assignment mutator) so the test can focus on the
 * contextual scoring + persistence behaviour.
 */
function buildService(overrides: Partial<{
  candidates: Array<{ technician: { id: string; lastLatitude: number | null; lastLongitude: number | null }; score: number; distanceKm: number | null; activeJobs: number; breakdown: Record<string, number> }>;
  prismaBookingId: string | null;
}> = {}) {
  const assignment = {
    MIN_AUTO_SCORE: 55,
    findCandidates: jest.fn().mockResolvedValue(overrides.candidates ?? []),
    pickBest: jest.fn(),
  };
  const bookings = {
    assignTechnician: jest.fn().mockResolvedValue(undefined),
  };
  const routing = {
    estimate: jest.fn().mockResolvedValue({
      distanceM: 5_000,
      durationS: 600,
      trafficDurationS: 720,
      polyline: null,
      provider: 'haversine',
    }),
  };
  const tracking = { nearestTechnicians: jest.fn() };
  const events = { publish: jest.fn() };
  const prismaClient = {
    booking: {
      findFirst: jest.fn().mockResolvedValue(
        overrides.prismaBookingId === null
          ? null
          : {
              id: 'bk_1',
              tenantId: 't',
              code: 'ACB-1',
              status: 'PENDING',
              technicianId: null,
              customerId: 'cust_1',
              cityId: 'city_1',
              category: ServiceCategory.AC_REPAIR,
              priority: BookingPriority.STANDARD,
              scheduledAt: new Date('2026-01-01T10:00:00Z'),
              geoLatitude: 12.98,
              geoLongitude: 77.6,
              deletedAt: null,
            },
      ),
      findMany: jest.fn().mockResolvedValue([]),
    },
    dispatchAssignment: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest
        .fn()
        .mockImplementation((args: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'da_1', ...args.data }),
        ),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    dispatchEvent: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'de_1', ...args.data })),
    },
    technician: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'tech_1', fullName: 'Test Tech', status: 'AVAILABLE', rating: 4.7 },
      ]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    technicianAvailability: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const prisma = { client: prismaClient };

  const service = new DispatchService(
    prisma as never,
    assignment as never,
    bookings as never,
    routing as never,
    tracking as never,
    events as never,
  );
  return { service, assignment, bookings, routing, events, prisma };
}

describe('DispatchService.recommend', () => {
  it('returns sorted recommendations with ETA + priority bonuses', async () => {
    const { service, prisma } = buildService({
      candidates: [
        {
          technician: { id: 'tech_1', lastLatitude: 12.97, lastLongitude: 77.6 },
          score: 80,
          distanceKm: 5,
          activeJobs: 0,
          breakdown: { skillMatch: 40, proximity: 20, workload: 20, rating: 14 },
        },
      ],
    });
    const out = await service.recommend(
      { userId: 'u', tenantId: 't' } as never,
      'bk_1',
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.score).toBeGreaterThanOrEqual(80);
    expect(out[0]?.breakdown.eta).toBeGreaterThanOrEqual(0);
    expect(prisma.client.dispatchAssignment.deleteMany).toHaveBeenCalled();
    expect(prisma.client.dispatchAssignment.createMany).toHaveBeenCalled();
  });
});

describe('DispatchService.autoAssign', () => {
  it('raises NO_CANDIDATES alert + throws when no eligible tech exists', async () => {
    const { service, prisma } = buildService({ candidates: [] });
    await expect(
      service.autoAssign({ userId: 'u', tenantId: 't' } as never, 'bk_1'),
    ).rejects.toBeInstanceOf(ConflictException);
    const calls = (prisma.client.dispatchEvent.create as jest.Mock).mock.calls;
    expect(calls[0]?.[0].data.kind).toBe(DispatchAlertKind.NO_CANDIDATES);
  });

  it('falls back to recommendations when top score is below auto-pick threshold', async () => {
    const { service } = buildService({
      candidates: [
        {
          technician: { id: 'tech_low', lastLatitude: 14, lastLongitude: 78 },
          score: 30,
          distanceKm: 50,
          activeJobs: 3,
          breakdown: { skillMatch: 0, proximity: 0, workload: 0, rating: 30 },
        },
      ],
    });
    await expect(
      service.autoAssign({ userId: 'u', tenantId: 't' } as never, 'bk_1'),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'LOW_CONFIDENCE' }) });
  });

  it('records an AUTO_ASSIGNED row when the top candidate clears the threshold', async () => {
    const { service, bookings, prisma } = buildService({
      candidates: [
        {
          technician: { id: 'tech_1', lastLatitude: 12.97, lastLongitude: 77.6 },
          score: 90,
          distanceKm: 2,
          activeJobs: 0,
          breakdown: { skillMatch: 40, proximity: 25, workload: 20, rating: 14 },
        },
      ],
    });
    await service.autoAssign({ userId: 'u', tenantId: 't' } as never, 'bk_1');
    expect(bookings.assignTechnician).toHaveBeenCalled();
    const createCall = (prisma.client.dispatchAssignment.create as jest.Mock).mock.calls[0]?.[0];
    expect(createCall.data.decision).toBe(DispatchDecision.AUTO_ASSIGNED);
  });
});

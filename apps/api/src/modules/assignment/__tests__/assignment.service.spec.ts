import { ServiceCategory, TechnicianStatus } from '@ac/types';

import { AssignmentService } from '../assignment.service';

function makeTech(overrides: Partial<{ id: string; rating: number; lat: number; lng: number; skills: string[] }> = {}) {
  return {
    id: overrides.id ?? 'tech_1',
    tenantId: 't',
    userId: 'u',
    cityId: 'city_1',
    employeeCode: 'T1',
    fullName: 'Test Tech',
    phone: '+9100',
    skills: overrides.skills ?? ['AC_REPAIR'],
    rating: overrides.rating ?? 4.5,
    totalJobs: 100,
    status: TechnicianStatus.AVAILABLE,
    lastLatitude: overrides.lat ?? 12.9716,
    lastLongitude: overrides.lng ?? 77.5946,
    lastLocationAt: new Date(),
    workingHours: {},
    documents: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

function buildService(techs: ReturnType<typeof makeTech>[]) {
  const prisma = {
    client: {
      technician: { findMany: jest.fn().mockResolvedValue(techs) },
      booking: { groupBy: jest.fn().mockResolvedValue([]) },
    },
  };
  return new AssignmentService(prisma as never);
}

describe('AssignmentService', () => {
  it('returns empty list when no candidates match the city/skill filter', async () => {
    const svc = buildService([]);
    const out = await svc.findCandidates({
      tenantId: 't',
      cityId: 'city_1',
      category: ServiceCategory.AC_REPAIR,
    });
    expect(out).toEqual([]);
  });

  it('ranks the nearest, highest-rated, lightest-loaded technician first', async () => {
    const techs = [
      makeTech({ id: 'far_low', lat: 13.5, lng: 77.5, rating: 3 }),
      makeTech({ id: 'near_high', lat: 12.98, lng: 77.6, rating: 4.9 }),
      makeTech({ id: 'medium', lat: 12.99, lng: 77.62, rating: 4.0 }),
    ];
    const svc = buildService(techs);
    const out = await svc.findCandidates({
      tenantId: 't',
      cityId: 'city_1',
      category: ServiceCategory.AC_REPAIR,
      geo: { latitude: 12.98, longitude: 77.6 },
    });
    expect(out[0]?.technician.id).toBe('near_high');
  });

  it('pickBest returns null when the top score is below MIN_AUTO_SCORE', async () => {
    // Single tech with poor distance + average rating + max workload.
    const techs = [makeTech({ id: 'low', lat: 14, lng: 78, rating: 2 })];
    const svc = buildService(techs);
    // Simulate workload of 5 active jobs to suppress workload score.
    (svc as unknown as { prisma: { client: { booking: { groupBy: jest.Mock } } } }).prisma.client.booking.groupBy = jest
      .fn()
      .mockResolvedValue([{ technicianId: 'low', _count: { _all: 5 } }]) as never;

    const best = await svc.pickBest({
      tenantId: 't',
      cityId: 'city_1',
      category: ServiceCategory.AC_REPAIR,
      geo: { latitude: 12.9, longitude: 77.5 },
    });
    expect(best).toBeNull();
  });
});

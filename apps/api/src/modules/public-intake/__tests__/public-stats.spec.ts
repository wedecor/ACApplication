import { PublicIntakeService, summariseRatings } from '../public-intake.service';

describe('summariseRatings', () => {
  it('rounds to one decimal', () => {
    expect(summariseRatings(4.56, 12)).toEqual({ averageRating: 4.6, ratingCount: 12 });
  });
  it('omits the average when there are no ratings', () => {
    expect(summariseRatings(null, 0)).toEqual({ ratingCount: 0 });
  });
});

describe('PublicIntakeService.ratingSummary', () => {
  it('aggregates BookingRating once and serves from cache', async () => {
    const aggregate = jest.fn().mockResolvedValue({ _avg: { value: 4.25 }, _count: { _all: 4 } });
    const svc = new PublicIntakeService({ client: { bookingRating: { aggregate } } } as never, {} as never);
    expect(await svc.ratingSummary('t1')).toEqual({ averageRating: 4.3, ratingCount: 4 });
    await svc.ratingSummary('t1');
    expect(aggregate).toHaveBeenCalledTimes(1);
  });
  it('falls back gracefully when the query fails', async () => {
    const aggregate = jest.fn().mockRejectedValue(new Error('down'));
    const svc = new PublicIntakeService({ client: { bookingRating: { aggregate } } } as never, {} as never);
    expect(await svc.ratingSummary('t1')).toEqual({ ratingCount: 0 });
  });
});

describe('PublicIntakeService.publicStats', () => {
  it('reports real completed repairs alongside the rating summary', async () => {
    const count = jest.fn(({ where }: { where: { status?: string } }) => Promise.resolve(where.status === 'COMPLETED' ? 128 : 3));
    const client = {
      booking: { count },
      customer: { count: jest.fn().mockResolvedValue(96) },
      technician: { count: jest.fn().mockResolvedValue(5) },
      city: { count: jest.fn().mockResolvedValue(2) },
      bookingRating: { aggregate: jest.fn().mockResolvedValue({ _avg: { value: 4.42 }, _count: { _all: 37 } }) },
    };
    const svc = new PublicIntakeService({ client } as never, {} as never);
    jest.spyOn(svc, 'resolveTenantId').mockResolvedValue('t1');
    await expect(svc.publicStats(null)).resolves.toEqual({
      bookingsToday: 3,
      completedRepairs: 128,
      customersServed: 96,
      techniciansLive: 5,
      citiesLive: 2,
      averageRating: 4.4,
      ratingCount: 37,
    });
    expect(count).toHaveBeenCalledWith({ where: { tenantId: 't1', status: 'COMPLETED', deletedAt: null } });
  });
});

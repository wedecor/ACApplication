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

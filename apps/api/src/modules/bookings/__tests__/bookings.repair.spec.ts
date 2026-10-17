import { BookingStatus } from '@ac/types';

import { actor, buildService, makeBooking } from './bookings.test-helpers';

const DAY = 24 * 60 * 60 * 1000;

describe('BookingsService — repair integration on COMPLETED', () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date('2026-10-16T08:00:00.000Z') }));
  afterEach(() => jest.useRealTimers());

  it('stamps repairWarrantyUntil = completedAt + 30 days without a catalog item', async () => {
    const { svc, repo } = buildService(makeBooking({ status: BookingStatus.IN_PROGRESS }));
    await svc.changeStatus(actor, 'book_1', { status: BookingStatus.COMPLETED });
    const data = repo.update.mock.calls[0][1] as Record<string, Date>;
    expect(data['repairWarrantyUntil']!.getTime()).toBe(data['completedAt']!.getTime() + 30 * DAY);
  });

  it('uses the catalog item repairWarrantyDays and updates the appliance + revisit claim', async () => {
    const { svc, repo, tx } = buildService(
      makeBooking({
        status: BookingStatus.IN_PROGRESS,
        catalogItem: { repairWarrantyDays: 90 },
        applianceId: 'ap1',
        isWarrantyRevisit: true,
      }),
    );
    const txModels = tx as unknown as Record<string, unknown>;
    txModels['customerAppliance'] = { update: jest.fn() };
    txModels['warrantyClaim'] = { updateMany: jest.fn() };

    await svc.changeStatus(actor, 'book_1', { status: BookingStatus.COMPLETED });
    const data = repo.update.mock.calls[0][1] as Record<string, Date>;
    expect(data['repairWarrantyUntil']!.getTime()).toBe(data['completedAt']!.getTime() + 90 * DAY);
    expect((txModels['customerAppliance'] as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { id: 'ap1' },
      data: { lastServicedAt: data['completedAt'], updatedBy: 'user_1' },
    });
    expect((txModels['warrantyClaim'] as { updateMany: jest.Mock }).updateMany).toHaveBeenCalledWith({
      where: { revisitBookingId: 'book_1', status: 'APPROVED' },
      data: { status: 'CLOSED', updatedBy: 'user_1' },
    });
  });

  it('does not stamp a warranty on other transitions', async () => {
    const { svc, repo } = buildService(makeBooking({ status: BookingStatus.IN_PROGRESS }));
    await svc.changeStatus(actor, 'book_1', { status: BookingStatus.WAITING_PARTS });
    expect((repo.update.mock.calls[0][1] as Record<string, unknown>)['repairWarrantyUntil']).toBeUndefined();
  });
});

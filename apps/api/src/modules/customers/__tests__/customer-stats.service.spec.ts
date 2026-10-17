import { DomainEventName } from '@ac/types';

import { CustomerStatsService } from '../customer-stats.service';

function build({ bookings = 0, paid = 0, refunded = 0, exists = true } = {}) {
  const client = {
    booking: {
      count: jest.fn().mockResolvedValue(bookings),
      findUnique: jest.fn().mockResolvedValue({ customerId: 'c1' }),
    },
    invoice: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amountPaidMinor: paid, amountRefundedMinor: refunded } }),
      findUnique: jest.fn().mockResolvedValue({ customerId: 'c1' }),
    },
    customer: { updateMany: jest.fn().mockResolvedValue({ count: exists ? 1 : 0 }) },
  };
  const svc = new CustomerStatsService({ client } as never);
  return { svc, client };
}

describe('CustomerStatsService', () => {
  it('recomputes bookings (excluding drafts) and paid-minus-refunded value', async () => {
    const { svc, client } = build({ bookings: 4, paid: 250_000, refunded: 50_000 });
    await expect(svc.recompute('c1')).resolves.toEqual({ totalBookings: 4, lifetimeValueMinor: 200_000 });
    expect(client.booking.count).toHaveBeenCalledWith({
      where: { customerId: 'c1', deletedAt: null, status: { not: 'DRAFT' } },
    });
    expect(client.customer.updateMany).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { totalBookings: 4, lifetimeValueMinor: BigInt(200_000) },
    });
  });

  it('never goes negative when refunds exceed payments', async () => {
    const { svc } = build({ paid: 1000, refunded: 5000 });
    await expect(svc.recompute('c1')).resolves.toMatchObject({ lifetimeValueMinor: 0 });
  });

  it('returns null for an unknown customer', async () => {
    const { svc } = build({ exists: false });
    await expect(svc.recompute('nope')).resolves.toBeNull();
  });

  it('resolves the customer from the invoice on refund events and swallows failures', async () => {
    const { svc, client } = build();
    client.customer.updateMany.mockRejectedValueOnce(new Error('db down'));
    await expect(
      svc.onInvoiceRefunded({
        name: DomainEventName.InvoiceRefunded,
        payload: { invoiceId: 'i1', refundId: 'r1', amountMinor: 100 },
      } as never),
    ).resolves.toBeUndefined();
    expect(client.invoice.findUnique).toHaveBeenCalled();
  });
});

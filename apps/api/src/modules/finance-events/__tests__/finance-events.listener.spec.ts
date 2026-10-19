import {
  type BookingCompletedEvent,
  type BookingId,
  type CustomerId,
  DomainEventName,
  type InvoiceId,
  type InvoicePaidEvent,
  type TechnicianId,
} from '@ac/types';

import { FinanceEventsListener } from '../finance-events.listener';

describe('FinanceEventsListener', () => {
  let listener: FinanceEventsListener;
  let prismaMock: { client: { invoice: { findUnique: jest.Mock } } };
  let amcMock: { onSubscriptionInvoicePaid: jest.Mock };
  let payoutsMock: { accrueForBooking: jest.Mock };

  beforeEach(() => {
    prismaMock = {
      client: {
        invoice: {
          findUnique: jest.fn(),
        },
      },
    };
    amcMock = {
      onSubscriptionInvoicePaid: jest.fn().mockResolvedValue(undefined),
    };
    payoutsMock = {
      accrueForBooking: jest.fn().mockResolvedValue(undefined),
    };

    listener = new FinanceEventsListener(
      prismaMock as never,
      amcMock as never,
      payoutsMock as never,
    );
  });

  describe('onInvoicePaid', () => {
    const event: InvoicePaidEvent = {
      id: 'evt_1',
      name: DomainEventName.InvoicePaid,
      occurredAt: new Date().toISOString(),
      actorId: null,
      tenantId: 'tenant_1',
      payload: {
        invoiceId: 'inv_1' as InvoiceId,
        customerId: 'cust_1' as CustomerId,
        paidAmountMinor: 100000,
      },
    };

    it('activates AMC subscription when invoice is linked to an AMC subscription', async () => {
      prismaMock.client.invoice.findUnique.mockResolvedValue({
        amcSubscriptionId: 'amc_sub_123',
      });

      await listener.onInvoicePaid(event);

      expect(prismaMock.client.invoice.findUnique).toHaveBeenCalledWith({
        where: { id: 'inv_1' },
        select: { amcSubscriptionId: true },
      });
      expect(amcMock.onSubscriptionInvoicePaid).toHaveBeenCalledWith('amc_sub_123', 'inv_1');
    });

    it('does not invoke AMC service when invoice has no amcSubscriptionId', async () => {
      prismaMock.client.invoice.findUnique.mockResolvedValue({
        amcSubscriptionId: null,
      });

      await listener.onInvoicePaid(event);

      expect(prismaMock.client.invoice.findUnique).toHaveBeenCalledWith({
        where: { id: 'inv_1' },
        select: { amcSubscriptionId: true },
      });
      expect(amcMock.onSubscriptionInvoicePaid).not.toHaveBeenCalled();
    });

    it('does not invoke AMC service when invoice is not found', async () => {
      prismaMock.client.invoice.findUnique.mockResolvedValue(null);

      await listener.onInvoicePaid(event);

      expect(prismaMock.client.invoice.findUnique).toHaveBeenCalledWith({
        where: { id: 'inv_1' },
        select: { amcSubscriptionId: true },
      });
      expect(amcMock.onSubscriptionInvoicePaid).not.toHaveBeenCalled();
    });

    it('swallows error and logs warning when amc service throws', async () => {
      prismaMock.client.invoice.findUnique.mockResolvedValue({
        amcSubscriptionId: 'amc_sub_123',
      });
      amcMock.onSubscriptionInvoicePaid.mockRejectedValue(new Error('AMC failure'));

      await expect(listener.onInvoicePaid(event)).resolves.toBeUndefined();
      expect(amcMock.onSubscriptionInvoicePaid).toHaveBeenCalledWith('amc_sub_123', 'inv_1');
    });
  });

  describe('onBookingCompleted', () => {
    const event: BookingCompletedEvent = {
      id: 'evt_2',
      name: DomainEventName.BookingCompleted,
      occurredAt: new Date().toISOString(),
      actorId: null,
      tenantId: 'tenant_1',
      payload: {
        bookingId: 'book_100' as BookingId,
        technicianId: 'tech_1' as TechnicianId,
        finalAmountMinor: 150000,
      },
    };

    it('calls payouts.accrueForBooking with the bookingId', async () => {
      await listener.onBookingCompleted(event);

      expect(payoutsMock.accrueForBooking).toHaveBeenCalledWith('book_100');
    });

    it('swallows error and logs warning when payouts service throws', async () => {
      payoutsMock.accrueForBooking.mockRejectedValue(new Error('Payout failure'));

      await expect(listener.onBookingCompleted(event)).resolves.toBeUndefined();
      expect(payoutsMock.accrueForBooking).toHaveBeenCalledWith('book_100');
    });
  });
});

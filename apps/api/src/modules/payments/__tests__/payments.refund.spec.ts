import { BadRequestException } from '@nestjs/common';
import { PaymentStatus, RefundStatus } from '@ac/types';

import { PaymentsService } from '../payments.service';

const actor = { tenantId: 't1', userId: 'u1' } as never;

function build(paymentOverrides: Record<string, unknown> = {}) {
  const prisma = {
    client: {
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'pay_1',
          invoiceId: 'inv_1',
          transactionId: 'txn_1',
          status: PaymentStatus.CAPTURED,
          gatewayRef: 'pay_gw',
          transaction: { provider: 'razorpay', paymentRef: 'pay_gw' },
          ...paymentOverrides,
        }),
      },
      refund: { update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'ref_1', invoiceId: 'inv_1', customerId: 'c1', ...data })) },
    },
  };
  const invoices = {
    refund: jest.fn().mockResolvedValue({ refund: { id: 'ref_1' } }),
    reverseFailedRefund: jest.fn().mockResolvedValue(undefined),
  };
  const razorpay = { issueRefund: jest.fn().mockResolvedValue({ refundRef: 'rfnd_1', status: 'processing', rawPayload: {} }) };
  const events = { publish: jest.fn() };
  const svc = new PaymentsService(prisma as never, events as never, invoices as never, razorpay as never, {} as never);
  return { svc, prisma, invoices, razorpay, events };
}

describe('PaymentsService.refundPayment', () => {
  it('reserves through the invoice (cap + bookkeeping) before calling the gateway', async () => {
    const { svc, invoices, razorpay } = build();
    await svc.refundPayment(actor, 'pay_1', { amountMinor: 5_000, reason: 'faulty' });
    expect(invoices.refund).toHaveBeenCalledWith(actor, 'inv_1', expect.objectContaining({ paymentId: 'pay_1', amountMinor: 5_000 }));
    expect(invoices.refund.mock.invocationCallOrder[0]).toBeLessThan(razorpay.issueRefund.mock.invocationCallOrder[0]);
    expect(razorpay.issueRefund).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'refund_ref_1', amountMinor: 5_000 }));
  });

  it('does not reach the gateway when the reservation is refused (over the refundable amount)', async () => {
    const { svc, invoices, razorpay } = build();
    invoices.refund.mockRejectedValueOnce(new BadRequestException('Refund exceeds remaining refundable amount'));
    await expect(svc.refundPayment(actor, 'pay_1', { amountMinor: 999_999 })).rejects.toBeInstanceOf(BadRequestException);
    expect(razorpay.issueRefund).not.toHaveBeenCalled();
  });

  it('reverses the bookkeeping when the gateway rejects the refund', async () => {
    const { svc, invoices, razorpay } = build();
    razorpay.issueRefund.mockRejectedValueOnce(new Error('insufficient balance'));
    await expect(svc.refundPayment(actor, 'pay_1', { amountMinor: 100 })).rejects.toBeInstanceOf(BadRequestException);
    expect(invoices.reverseFailedRefund).toHaveBeenCalledWith(actor, 'ref_1', 'insufficient balance');
  });

  it('records the gateway reference and status on success', async () => {
    const { svc, prisma } = build();
    await svc.refundPayment(actor, 'pay_1', { amountMinor: 100 });
    expect(prisma.client.refund.update.mock.calls[0][0].data).toMatchObject({ gatewayRef: 'rfnd_1', status: RefundStatus.PROCESSING });
  });
});

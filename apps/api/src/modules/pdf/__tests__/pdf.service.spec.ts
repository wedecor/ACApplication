import { PdfService } from '../pdf.service';

describe('PdfService — smoke tests', () => {
  const svc = new PdfService();

  it('invoice() emits a valid PDF buffer with a stable hash', async () => {
    const { buffer, hash } = await svc.invoice({
      invoice: {
        number: 'INV-2025-000001',
        status: 'SENT',
        issueDate: new Date('2025-01-15T10:00:00.000Z'),
        dueDate: new Date('2025-02-01T10:00:00.000Z'),
        currency: 'INR',
        subtotalMinor: 100_000,
        discountMinor: 0,
        taxMinor: 18_000,
        cgstMinor: 9_000,
        sgstMinor: 9_000,
        igstMinor: 0,
        totalMinor: 118_000,
        amountPaidMinor: 0,
        dueAmountMinor: 118_000,
        notes: 'Thank you for your business.',
        terms: 'Payable within 14 days.',
        placeOfSupply: 'KA',
        gstEnabled: true,
        gstNumber: '29AAAAA0000A1Z5',
      },
      customer: {
        name: 'Acme Industries',
        email: 'billing@acme.test',
        phone: '+91 98000 00000',
        address: '12 MG Road, Bengaluru, KA 560001',
        gstin: '29AAACX0000A1Z5',
      },
      lines: [
        {
          description: 'Split AC service — 1 tonne',
          quantity: 1,
          unitPriceMinor: 100_000,
          taxRateBps: 1800,
          subtotalMinor: 100_000,
          taxMinor: 18_000,
          totalMinor: 118_000,
          hsnSacCode: '9987',
        },
      ],
      qrPayload: 'upi://pay?pa=acme@upi&am=1180&cu=INR',
    });
    expect(buffer.length).toBeGreaterThan(1000);
    // PDF magic number
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  }, 15_000);

  it('amcContract() emits a valid PDF', async () => {
    const { buffer, hash } = await svc.amcContract({
      subscription: {
        number: 'AMC-2025-000001',
        startsAt: new Date('2025-01-01T00:00:00Z'),
        endsAt: new Date('2026-01-01T00:00:00Z'),
        priceMinor: 599_000,
        currency: 'INR',
        visitsScheduled: 4,
        autoRenew: true,
      },
      plan: {
        name: 'Premium AMC',
        type: 'PREMIUM',
        includedVisits: 4,
        description: 'Includes 4 quarterly visits and emergency support.',
        features: ['Emergency response', 'Priority dispatch', 'Free parts under ₹500'],
        emergencySupport: true,
        prioritySupport: true,
      },
      customer: {
        name: 'Acme Industries',
        email: 'billing@acme.test',
        phone: '+91 98000 00000',
      },
    });
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  }, 15_000);
});

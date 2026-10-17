import {
  buildTimeline,
  categoryLabel,
  normalizeCategory,
  notificationData,
  notificationTypeForTemplate,
  planFeatures,
  serverStatusesForFilter,
  snapshotAppliances,
  toAppAddressLabel,
  toAppAmcStatus,
  toAppBookingStatus,
  toAppInvoiceStatus,
  toAppPaymentMethodType,
  warrantyStatus,
} from '../me.mappers';

describe('booking status mapping', () => {
  it.each([
    ['DRAFT', 'CREATED'],
    ['PENDING', 'CREATED'],
    ['CONFIRMED', 'CONFIRMED'],
    ['RESCHEDULED', 'CONFIRMED'],
    ['ASSIGNED', 'ASSIGNED'],
    ['TECHNICIAN_EN_ROUTE', 'EN_ROUTE'],
    ['IN_PROGRESS', 'IN_PROGRESS'],
    ['WAITING_PARTS', 'AWAITING_PARTS'],
    ['COMPLETED', 'COMPLETED'],
    ['CANCELLED', 'CANCELLED'],
    ['NO_SHOW', 'NO_SHOW'],
  ])('%s → %s', (server, app) => {
    expect(toAppBookingStatus(server)).toBe(app);
  });

  it('renders en-route with arrivedAt as ARRIVED', () => {
    expect(toAppBookingStatus('TECHNICIAN_EN_ROUTE', { arrived: true })).toBe('ARRIVED');
  });

  it('maps list filters to server statuses', () => {
    expect(serverStatusesForFilter('completed')).toEqual(['COMPLETED']);
    expect(serverStatusesForFilter('cancelled')).toEqual(['CANCELLED', 'NO_SHOW']);
    expect(serverStatusesForFilter('active')).toContain('WAITING_PARTS');
    expect(serverStatusesForFilter('active')).not.toContain('COMPLETED');
    expect(serverStatusesForFilter()).not.toContain('DRAFT');
  });

  it('builds a deduped, ascending timeline that starts with CREATED', () => {
    const created = new Date('2026-01-01T00:00:00Z');
    const tl = buildTimeline(
      [
        { toStatus: 'ASSIGNED', createdAt: new Date('2026-01-01T02:00:00Z'), message: null },
        { toStatus: null, createdAt: new Date('2026-01-01T01:30:00Z'), message: 'note' },
        { toStatus: 'CONFIRMED', createdAt: new Date('2026-01-01T01:00:00Z'), message: null },
        { toStatus: 'RESCHEDULED', createdAt: new Date('2026-01-01T01:10:00Z'), message: 'moved' },
      ],
      created,
    );
    expect(tl.map((t) => t.status)).toEqual(['CREATED', 'CONFIRMED', 'ASSIGNED']);
    expect(tl[0]!.at).toBe(created.toISOString());
  });
});

describe('categories', () => {
  it('normalises server values, case and legacy aliases', () => {
    expect(normalizeCategory('ac_repair')).toBe('AC_REPAIR');
    expect(normalizeCategory('WASHING_MACHINE_REPAIR')).toBe('WASHING_MACHINE');
    expect(normalizeCategory('TV_REPAIR')).toBe('TELEVISION');
    expect(normalizeCategory('water purifier')).toBe('WATER_PURIFIER');
    expect(normalizeCategory('nope')).toBeNull();
    expect(normalizeCategory(undefined)).toBeNull();
  });
  it('labels categories', () => {
    expect(categoryLabel('INVERTER_UPS')).toBe('Inverter / UPS');
    expect(categoryLabel('???')).toBe('Appliance');
  });
});

describe('invoice / amc / misc mapping', () => {
  it('maps invoice statuses', () => {
    expect(toAppInvoiceStatus('SENT')).toBe('PENDING');
    expect(toAppInvoiceStatus('OVERDUE')).toBe('PENDING');
    expect(toAppInvoiceStatus('PARTIALLY_PAID')).toBe('PARTIAL');
    expect(toAppInvoiceStatus('PAID')).toBe('PAID');
    expect(toAppInvoiceStatus('REFUNDED')).toBe('REFUNDED');
    expect(toAppInvoiceStatus('CANCELLED')).toBe('CANCELLED');
  });

  it('maps AMC statuses incl. the expiring window', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(toAppAmcStatus('ACTIVE', new Date('2026-06-01T00:00:00Z'), now)).toBe('ACTIVE');
    expect(toAppAmcStatus('ACTIVE', new Date('2026-01-20T00:00:00Z'), now)).toBe('EXPIRING');
    expect(toAppAmcStatus('ACTIVE', new Date('2025-12-01T00:00:00Z'), now)).toBe('EXPIRED');
    expect(toAppAmcStatus('PENDING_PAYMENT', new Date(), now)).toBe('PENDING');
    expect(toAppAmcStatus('CANCELLED', new Date(), now)).toBe('EXPIRED');
  });

  it('reads plan features and subscription snapshots', () => {
    expect(planFeatures(['a', { label: 'b' }, 3, ''])).toEqual(['a', 'b']);
    expect(planFeatures(null)).toEqual([]);
    expect(
      snapshotAppliances(['AC_REPAIR', { category: 'REFRIGERATOR', brand: 'LG', applianceId: 'x' }]),
    ).toEqual([
      { applianceCategory: 'AC_REPAIR', label: 'Air Conditioner' },
      { applianceCategory: 'REFRIGERATOR', label: 'LG Refrigerator' },
    ]);
  });

  it('classifies notifications and strips sensitive payload keys', () => {
    expect(notificationTypeForTemplate('booking.assigned')).toBe('BOOKING');
    expect(notificationTypeForTemplate('invoice.sent')).toBe('PAYMENT');
    expect(notificationTypeForTemplate('amc.expiring')).toBe('AMC');
    expect(notificationTypeForTemplate('ticket.reply')).toBe('SUPPORT');
    expect(notificationTypeForTemplate('campaign.diwali')).toBe('PROMO');
    expect(notificationTypeForTemplate('auth.otp')).toBe('SYSTEM');
    expect(notificationData({ bookingId: 'b1', code: '123456', n: 2, nested: { a: 1 } })).toEqual({
      bookingId: 'b1',
      n: '2',
    });
  });

  it('maps address labels and payment method types', () => {
    expect(toAppAddressLabel('home')).toBe('HOME');
    expect(toAppAddressLabel('Mum')).toBe('OTHER');
    expect(toAppAddressLabel(null)).toBe('OTHER');
    expect(toAppPaymentMethodType('net_banking')).toBe('NETBANKING');
    expect(toAppPaymentMethodType('upi')).toBe('UPI');
    expect(toAppPaymentMethodType('visa')).toBe('CARD');
  });
});

describe('warrantyStatus', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  it('is UNKNOWN with no dates', () => {
    expect(warrantyStatus([null, undefined], now).status).toBe('UNKNOWN');
  });
  it('uses the latest cover date', () => {
    const r = warrantyStatus([new Date('2025-01-01T00:00:00Z'), new Date('2027-01-01T00:00:00Z')], now);
    expect(r.status).toBe('IN_WARRANTY');
    expect(r.until?.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
  it('flags expiring soon and expired', () => {
    expect(warrantyStatus([new Date('2026-01-15T00:00:00Z')], now).status).toBe('EXPIRING_SOON');
    expect(warrantyStatus([new Date('2025-12-15T00:00:00Z')], now).status).toBe('EXPIRED');
  });
});

import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { haversineKm, MeBookingsService, type MyBookingRow,toBookingSummary } from '../me-bookings.service';

const actor = { userId: 'u1', tenantId: 't1' } as never;
const customer = { id: 'c1', tenantId: 't1', userId: 'u1', fullName: 'A', phone: '+91', email: null, cityId: null, defaultAddressId: null };

function build() {
  const prisma = {
    client: {
      booking: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      bookingRating: { findUnique: jest.fn(), create: jest.fn(), aggregate: jest.fn() },
      technician: { update: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
      address: { findFirst: jest.fn() },
      customerAppliance: { findFirst: jest.fn() },
      city: { findFirst: jest.fn() },
      serviceCatalogItem: { findMany: jest.fn().mockResolvedValue([]) },
    },
  };
  const ctx = { requireCustomer: jest.fn().mockResolvedValue(customer) };
  const bookings = { create: jest.fn(), changeStatus: jest.fn(), reschedule: jest.fn(), addNote: jest.fn(), addAttachment: jest.fn() };
  const tickets = { create: jest.fn() };
  const storage = { isConfigured: jest.fn().mockReturnValue(false), keyFromPublicUrl: jest.fn(), isTenantObjectUrl: jest.fn() };
  const svc = new MeBookingsService(prisma as never, ctx as never, bookings as never, tickets as never, storage as never);
  return { svc, prisma, bookings, tickets, storage };
}

const row = (over: Partial<MyBookingRow> = {}): MyBookingRow =>
  ({
    id: 'b1',
    code: 'ACB-1',
    status: 'TECHNICIAN_EN_ROUTE',
    category: 'AC_REPAIR',
    serviceType: 'AC not cooling',
    applianceBrand: null,
    applianceType: null,
    issueDescription: null,
    priority: 'EMERGENCY',
    scheduledAt: new Date('2026-01-01T03:30:00Z'),
    scheduledTimeSlot: '09:00-12:00',
    estimatedAmountMinor: 49900,
    finalAmountMinor: null,
    discountMinor: 0,
    couponCode: null,
    serviceMode: 'ON_SITE',
    applianceId: 'ap1',
    arrivedAt: null,
    addressSnapshot: {},
    geoLatitude: 12.9,
    geoLongitude: 77.6,
    metadata: { slotLabel: 'Thu • Morning' },
    notes: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    appliance: { id: 'ap1', brand: 'Daikin', category: 'AC_REPAIR', modelNumber: null },
    address: { line1: 'L1', line2: null, city: 'Bengaluru', pincode: '560001', landmark: null, latitude: null, longitude: null },
    technician: { id: 'tech1', fullName: 'Ravi', phone: '+9199', rating: 4.5, totalJobs: 10, user: { avatarUrl: null } },
    ...over,
  });

describe('toBookingSummary', () => {
  it('maps a row to the app contract', () => {
    const s = toBookingSummary(row());
    expect(s.status).toBe('EN_ROUTE');
    expect(s.applianceLabel).toBe('Daikin Air Conditioner');
    expect(s.slotLabel).toBe('Thu • Morning');
    expect(s.isEmergency).toBe(true);
    expect(s.technician?.phone).toBe('+9199');
    expect(s.address?.lat).toBe(12.9);
  });
  it('hides technician contact outside the live window', () => {
    expect(toBookingSummary(row({ status: 'COMPLETED' })).technician?.phone).toBeNull();
  });
});

describe('MeBookingsService', () => {
  it('scopes list to the caller', async () => {
    const { svc, prisma } = build();
    prisma.client.booking.findMany.mockResolvedValue([row()]);
    await svc.list(actor, { status: 'active' });
    const where = prisma.client.booking.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ tenantId: 't1', customerId: 'c1' });
  });

  it('404s on bookings that are not mine', async () => {
    const { svc, prisma } = build();
    prisma.client.booking.findFirst.mockResolvedValue(null);
    await expect(svc.cancel(actor, 'other', { reason: 'x y' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses to cancel once the technician is en route', async () => {
    const { svc, prisma, bookings } = build();
    prisma.client.booking.findFirst.mockResolvedValue({ id: 'b1', status: 'TECHNICIAN_EN_ROUTE' });
    await expect(svc.cancel(actor, 'b1', { reason: 'changed mind' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(bookings.changeStatus).not.toHaveBeenCalled();
  });

  it('cancels via BookingsService.changeStatus', async () => {
    const { svc, prisma, bookings } = build();
    prisma.client.booking.findFirst.mockResolvedValueOnce({ id: 'b1', status: 'PENDING' }).mockResolvedValueOnce(row({ status: 'CANCELLED' }));
    const res = await svc.cancel(actor, 'b1', { reason: 'changed mind' });
    expect(bookings.changeStatus).toHaveBeenCalledWith(actor, 'b1', expect.objectContaining({ status: 'CANCELLED' }));
    expect(res.status).toBe('CANCELLED');
  });

  describe('rate', () => {
    it('only accepts completed bookings', async () => {
      const { svc, prisma } = build();
      prisma.client.booking.findFirst.mockResolvedValue({ id: 'b1', status: 'IN_PROGRESS' });
      await expect(svc.rate(actor, 'b1', { value: 5 })).rejects.toBeInstanceOf(BadRequestException);
    });
    it('rejects a second rating', async () => {
      const { svc, prisma } = build();
      prisma.client.booking.findFirst.mockResolvedValue({ id: 'b1', status: 'COMPLETED', technicianId: 'tech1' });
      prisma.client.bookingRating.findUnique.mockResolvedValue({ id: 'r1' });
      await expect(svc.rate(actor, 'b1', { value: 5 })).rejects.toBeInstanceOf(ConflictException);
    });
    it('stores the rating and recomputes the technician average', async () => {
      const { svc, prisma } = build();
      prisma.client.booking.findFirst.mockResolvedValue({ id: 'b1', status: 'COMPLETED', technicianId: 'tech1' });
      prisma.client.bookingRating.findUnique.mockResolvedValue(null);
      prisma.client.bookingRating.aggregate.mockResolvedValue({ _avg: { value: 4.333333 } });
      await svc.rate(actor, 'b1', { value: 4, npsScore: 9, comment: ' good ' });
      expect(prisma.client.bookingRating.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ bookingId: 'b1', customerId: 'c1', technicianId: 'tech1', value: 4, npsScore: 9, comment: 'good' }),
      });
      expect(prisma.client.technician.update).toHaveBeenCalledWith({ where: { id: 'tech1' }, data: { rating: 4.33 } });
    });
  });

  describe('create', () => {
    it('rejects an address that is not mine', async () => {
      const { svc, prisma } = build();
      prisma.client.address.findFirst.mockResolvedValue(null);
      await expect(
        svc.create(actor, { applianceCategory: 'AC_REPAIR', scheduledAt: '2030-01-01T00:00:00Z', addressId: 'x' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
    it('rejects an appliance that is not mine', async () => {
      const { svc, prisma } = build();
      prisma.client.address.findFirst.mockResolvedValue({ id: 'a1', city: 'Bengaluru' });
      prisma.client.customerAppliance.findFirst.mockResolvedValue(null);
      await expect(
        svc.create(actor, { applianceCategory: 'AC_REPAIR', scheduledAt: '2030-01-01T00:00:00Z', addressId: 'a1', applianceId: 'z' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
    it('delegates to BookingsService.create and stamps coupon + metadata', async () => {
      const { svc, prisma, bookings } = build();
      prisma.client.address.findFirst.mockResolvedValue({
        id: 'a1', line1: 'L1', line2: null, landmark: null, city: 'Bengaluru', state: 'KA', pincode: '560001', country: 'IN', latitude: 1, longitude: 2,
      });
      prisma.client.city.findFirst.mockResolvedValue({ id: 'city1', timezone: 'Asia/Kolkata' });
      bookings.create.mockResolvedValue({ id: 'b1' });
      prisma.client.booking.findFirst.mockResolvedValue(row({ status: 'PENDING' }));
      const res = await svc.create(actor, {
        applianceCategory: 'WASHING_MACHINE_REPAIR',
        issueId: 'not-spinning',
        scheduledAt: '2030-01-01T02:30:00Z',
        slotEnd: '2030-01-01T05:30:00Z',
        addressId: 'a1',
        serviceMode: 'CARRY_IN',
        couponCode: ' save10 ',
      });
      const payload = bookings.create.mock.calls[0][1];
      expect(payload).toMatchObject({
        customerId: 'c1',
        cityId: 'city1',
        category: 'WASHING_MACHINE',
        serviceType: 'Not spinning',
        scheduledTimeSlot: '08:00-11:00',
        estimatedAmountMinor: 34900,
        addressId: 'a1',
        serviceMode: 'CARRY_IN',
      });
      expect(prisma.client.booking.update.mock.calls[0][0].data.couponCode).toBe('SAVE10');
      expect(res.status).toBe('CREATED');
    });
  });

  it('returns null location outside the live window', async () => {
    const { svc, prisma } = build();
    prisma.client.booking.findFirst.mockResolvedValue({ id: 'b1', status: 'COMPLETED', technicianId: 'tech1' });
    expect(await svc.technicianLocation(actor, 'b1')).toBeNull();
  });

  it('opens a support ticket for complaints', async () => {
    const { svc, prisma, tickets } = build();
    prisma.client.booking.findFirst.mockResolvedValue({ id: 'b1', code: 'ACB-1', status: 'COMPLETED' });
    tickets.create.mockResolvedValue({ id: 'tk1', number: 'TKT-1' });
    expect(await svc.complaint(actor, 'b1', { reason: 'Rude', description: 'Was rude to me' })).toEqual({ ticketId: 'tk1' });
    expect(tickets.create.mock.calls[0][1]).toMatchObject({ customerId: 'c1', bookingId: 'b1', priority: 'HIGH' });
  });
});

describe('haversineKm', () => {
  it('is ~0 for the same point and ~111km per degree latitude', () => {
    expect(haversineKm({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
    expect(Math.round(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }))).toBe(111);
  });
});

import type { AuthPrincipal } from '@ac/auth';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

import { RepairEventName } from '../domain/events';
import { JobCardsService } from '../job-cards/job-cards.service';
import { RepairAccessService } from '../repair-access.service';
import { WarrantyService } from '../warranty/warranty.service';
import { WorkshopService } from '../workshop/workshop.service';

const staff = {
  userId: 'u_staff',
  tenantId: 't1',
  roles: ['DISPATCHER'],
  permissions: [],
} as unknown as AuthPrincipal;
const tech = {
  userId: 'u_tech',
  tenantId: 't1',
  roles: ['TECHNICIAN'],
  permissions: [],
} as unknown as AuthPrincipal;

function mockPrisma() {
  const model = () => ({
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'new', ...data })),
    update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'x', ...data })),
    count: jest.fn().mockResolvedValue(0),
  });
  type ModelMock = ReturnType<typeof model>;
  interface ClientMock {
    booking: ModelMock;
    jobCard: ModelMock;
    checklistTemplate: ModelMock;
    technician: ModelMock;
    workshopJob: ModelMock;
    warrantyClaim: ModelMock;
    customer: ModelMock;
    customerAppliance: ModelMock;
    $executeRawUnsafe: jest.Mock;
    $transaction: jest.Mock;
  }
  const client: ClientMock = {
    booking: model(),
    jobCard: model(),
    checklistTemplate: model(),
    technician: model(),
    workshopJob: model(),
    warrantyClaim: model(),
    customer: model(),
    customerAppliance: model(),
    $executeRawUnsafe: jest.fn(),
    $transaction: jest.fn(async (arg: unknown) =>
      typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(client) : Promise.all(arg as unknown[]),
    ),
  };
  return { client };
}

describe('JobCardsService', () => {
  function build() {
    const prisma = mockPrisma();
    const checklists = { activeForCategory: jest.fn().mockResolvedValue([]) };
    const events = { publish: jest.fn() };
    const access = new RepairAccessService(prisma as never);
    const svc = new JobCardsService(prisma as never, checklists as never, access, events as never);
    return { svc, prisma, checklists, events };
  }
  const booking = {
    id: 'b1',
    code: 'ACB-1',
    status: 'IN_PROGRESS',
    category: 'AC_REPAIR',
    technicianId: 'tech_1',
    applianceId: 'ap1',
    waitingPartsAt: null,
  };

  it('first write creates an IN_PROGRESS card with startedAt', async () => {
    const { svc, prisma } = build();
    prisma.client.booking.findFirst.mockResolvedValue(booking);
    prisma.client.jobCard.findFirst.mockResolvedValue(null);
    await svc.upsert(staff, 'b1', { diagnosis: 'Low gas', readings: { gasPsi: 40 } });
    const data = prisma.client.jobCard.create.mock.calls[0]![0].data;
    expect(data).toEqual(
      expect.objectContaining({
        bookingId: 'b1',
        status: 'IN_PROGRESS',
        technicianId: 'tech_1',
        applianceId: 'ap1',
        diagnosis: 'Low gas',
        readings: { gasPsi: 40 },
      }),
    );
    expect(data.startedAt).toBeInstanceOf(Date);
  });

  it('merges readings on later writes', async () => {
    const { svc, prisma } = build();
    prisma.client.booking.findFirst.mockResolvedValue(booking);
    prisma.client.jobCard.findFirst.mockResolvedValue({
      id: 'jc1',
      status: 'IN_PROGRESS',
      readings: { gasPsi: 40 },
      checklist: [],
      startedAt: new Date(),
    });
    await svc.upsert(staff, 'b1', { readings: { voltage: 230 } });
    const data = prisma.client.jobCard.update.mock.calls[0]![0].data;
    expect(data.readings).toEqual({ gasPsi: 40, voltage: 230 });
    expect(data.startedAt).toBeUndefined();
  });

  it('forbids technicians from touching bookings not assigned to them', async () => {
    const { svc, prisma } = build();
    prisma.client.booking.findFirst.mockResolvedValue({ ...booking, technicianId: 'someone_else' });
    prisma.client.technician.findFirst.mockResolvedValue({ id: 'tech_1' });
    await expect(svc.upsert(tech, 'b1', {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.client.jobCard.create).not.toHaveBeenCalled();
  });

  it('refuses to complete with unanswered required checklist items', async () => {
    const { svc, prisma, checklists, events } = build();
    prisma.client.booking.findFirst.mockResolvedValue(booking);
    prisma.client.jobCard.findFirst.mockResolvedValue({ id: 'jc1', status: 'IN_PROGRESS', checklist: [] });
    checklists.activeForCategory.mockResolvedValue([
      {
        id: 'tpl',
        kind: 'SAFETY',
        name: 'Safety',
        items: [{ key: 'earthing', label: 'Earthing', type: 'bool', required: true }],
      },
    ]);
    await expect(svc.complete(staff, 'b1', {})).rejects.toBeInstanceOf(BadRequestException);
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('completes and infers firstTimeFix when no parts wait happened', async () => {
    const { svc, prisma, events } = build();
    prisma.client.booking.findFirst.mockResolvedValue(booking);
    prisma.client.jobCard.findFirst.mockResolvedValue({
      id: 'jc1',
      status: 'IN_PROGRESS',
      checklist: [],
      startedAt: new Date(),
    });
    await svc.complete(staff, 'b1', {});
    const data = prisma.client.jobCard.update.mock.calls[0]![0].data;
    expect(data).toEqual(expect.objectContaining({ status: 'COMPLETED', firstTimeFix: true }));
    expect(events.publish).toHaveBeenCalledWith(RepairEventName.JobCardCompleted, expect.anything());
  });
});

describe('WorkshopService.transition', () => {
  function build(job: Record<string, unknown>) {
    const prisma = mockPrisma();
    prisma.client.workshopJob.findFirst.mockResolvedValue(job);
    const events = { publish: jest.fn() };
    return { svc: new WorkshopService(prisma as never, events as never), prisma, events };
  }
  const baseJob = {
    id: 'w1',
    number: 'WS-2026-000001',
    bookingId: 'b1',
    status: 'PICKUP_SCHEDULED',
    photos: ['a.jpg'],
    history: [],
    booking: { serviceMode: 'PICKUP_DROP' },
  };

  it('stamps the timestamp, appends history/photos and emits an event', async () => {
    const { svc, prisma, events } = build(baseJob);
    await svc.transition(staff, 'w1', { status: 'PICKED_UP', note: 'Collected', photos: ['b.jpg'] });
    const data = prisma.client.workshopJob.update.mock.calls[0]![0].data;
    expect(data.status).toBe('PICKED_UP');
    expect(data.pickedUpAt).toBeInstanceOf(Date);
    expect(data.photos).toEqual(['a.jpg', 'b.jpg']);
    expect(data.history).toEqual([
      expect.objectContaining({ status: 'PICKED_UP', from: 'PICKUP_SCHEDULED', note: 'Collected', by: 'u_staff' }),
    ]);
    expect(events.publish).toHaveBeenCalledWith(
      RepairEventName.WorkshopStatusChanged,
      expect.objectContaining({ from: 'PICKUP_SCHEDULED', to: 'PICKED_UP', bookingId: 'b1' }),
    );
  });

  it('rejects illegal transitions', async () => {
    const { svc, prisma } = build(baseJob);
    await expect(svc.transition(staff, 'w1', { status: 'REPAIRING' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.client.workshopJob.update).not.toHaveBeenCalled();
  });
});

describe('WarrantyService', () => {
  function build() {
    const prisma = mockPrisma();
    const appliances = {
      latestRepairWarranty: jest.fn().mockResolvedValue(null),
      isAmcCovered: jest.fn().mockResolvedValue(false),
    };
    const bookings = { create: jest.fn() };
    const events = { publish: jest.fn() };
    const svc = new WarrantyService(prisma as never, appliances as never, bookings as never, events as never);
    return { svc, prisma, appliances, bookings, events };
  }
  const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000);

  it('check: eligible inside the repair window', async () => {
    const { svc, prisma } = build();
    prisma.client.booking.findFirst.mockResolvedValue({
      id: 'b1',
      code: 'ACB-1',
      status: 'COMPLETED',
      repairWarrantyUntil: future,
      applianceId: null,
    });
    prisma.client.warrantyClaim.findFirst.mockResolvedValue(null);
    const res = await svc.check(staff, { bookingId: 'b1' });
    expect(res.eligibleForRepairRevisit).toBe(true);
    expect(res.originalBookingId).toBe('b1');
  });

  it('check: not eligible once expired', async () => {
    const { svc, prisma } = build();
    prisma.client.booking.findFirst.mockResolvedValue({
      id: 'b1',
      code: 'ACB-1',
      status: 'COMPLETED',
      repairWarrantyUntil: past,
      applianceId: null,
    });
    const res = await svc.check(staff, { bookingId: 'b1' });
    expect(res.eligibleForRepairRevisit).toBe(false);
    expect(res.reason).toMatch(/expired/);
  });

  it('create: rejects a revisit claim outside the warranty window', async () => {
    const { svc, prisma } = build();
    prisma.client.customer.findFirst.mockResolvedValue({ id: 'c1' });
    prisma.client.booking.findFirst.mockResolvedValue({
      id: 'b1',
      customerId: 'c1',
      status: 'COMPLETED',
      repairWarrantyUntil: past,
      applianceId: null,
    });
    await expect(
      svc.create(staff, { type: 'REPAIR_REVISIT', customerId: 'c1', originalBookingId: 'b1', reason: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create: numbers the claim WC-YYYY-NNNNNN', async () => {
    const { svc, prisma, events } = build();
    prisma.client.customer.findFirst.mockResolvedValue({ id: 'c1' });
    prisma.client.booking.findFirst.mockResolvedValue({
      id: 'b1',
      customerId: 'c1',
      status: 'COMPLETED',
      repairWarrantyUntil: future,
      applianceId: null,
    });
    prisma.client.warrantyClaim.findFirst.mockResolvedValue(null);
    const claim = await svc.create(staff, {
      type: 'REPAIR_REVISIT',
      customerId: 'c1',
      originalBookingId: 'b1',
      reason: 'Not cooling again',
    });
    expect(claim.number).toMatch(/^WC-\d{4}-000001$/);
    expect(events.publish).toHaveBeenCalledWith(RepairEventName.WarrantyClaimCreated, expect.anything());
  });

  it('decide: only OPEN claims', async () => {
    const { svc, prisma } = build();
    prisma.client.warrantyClaim.findFirst.mockResolvedValue({ id: 'w', status: 'APPROVED' });
    await expect(svc.decide(staff, 'w', { approve: true })).rejects.toBeInstanceOf(ConflictException);
  });

  it('revisit: creates a zero-charge revisit booking and links it', async () => {
    const { svc, prisma, bookings } = build();
    prisma.client.warrantyClaim.findFirst.mockResolvedValue({
      id: 'w',
      number: 'WC-2026-000001',
      type: 'REPAIR_REVISIT',
      status: 'APPROVED',
      revisitBookingId: null,
      originalBookingId: 'b1',
      applianceId: 'ap1',
      customerId: 'c1',
      reason: 'Leak',
    });
    prisma.client.booking.findFirst.mockResolvedValue({
      id: 'b1',
      code: 'ACB-1',
      customerId: 'c1',
      cityId: 'city',
      addressId: 'addr',
      category: 'AC_REPAIR',
      addressSnapshot: { line1: 'L1', city: 'Pune', state: 'MH', pincode: '411001' },
      serviceMode: 'ON_SITE',
      catalogItemId: null,
      applianceId: 'ap1',
    });
    bookings.create.mockResolvedValue({ id: 'b2' });
    await svc.scheduleRevisit(staff, 'w', { scheduledAt: future.toISOString() });
    const [, dto, opts] = bookings.create.mock.calls[0];
    expect(dto).toEqual(expect.objectContaining({ estimatedAmountMinor: 0, applianceId: 'ap1', addressId: 'addr' }));
    expect(opts).toEqual({ parentBookingId: 'b1', isWarrantyRevisit: true });
    expect(prisma.client.warrantyClaim.update.mock.calls[0]![0].data).toEqual(
      expect.objectContaining({ revisitBookingId: 'b2' }),
    );
  });

  it('oem: settling requires SUBMITTED_TO_OEM and an amount', async () => {
    const { svc, prisma } = build();
    prisma.client.warrantyClaim.findFirst.mockResolvedValue({ id: 'w', type: 'OEM_CLAIM', status: 'APPROVED' });
    await expect(svc.updateOem(staff, 'w', { status: 'SETTLED', settledAmountMinor: 100 })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

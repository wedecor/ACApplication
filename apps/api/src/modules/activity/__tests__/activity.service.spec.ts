import { ActivityType } from '@ac/types';

import { ActivityService } from '../activity.service';

describe('ActivityService', () => {
  let service: ActivityService;
  let prismaMock: {
    client: {
      leadActivity: {
        create: jest.Mock;
        findMany: jest.Mock;
      };
      bookingActivity: {
        create: jest.Mock;
        findMany: jest.Mock;
      };
    };
  };

  const tenantId = 'tenant_1';
  const actorUserId = 'user_1';

  beforeEach(() => {
    prismaMock = {
      client: {
        leadActivity: {
          create: jest.fn().mockResolvedValue({ id: 'la_1' }),
          findMany: jest.fn().mockResolvedValue([]),
        },
        bookingActivity: {
          create: jest.fn().mockResolvedValue({ id: 'ba_1' }),
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    };

    service = new ActivityService(prismaMock as never);
  });

  describe('recordLeadActivity', () => {
    it('creates a LeadActivity row using default prisma client', async () => {
      await service.recordLeadActivity('lead_1', {
        tenantId,
        type: ActivityType.STATUS_CHANGED,
        actorUserId,
        fromStatus: 'NEW',
        toStatus: 'CONTACTED',
        message: 'Customer reached via phone',
        metadata: { callDurationSec: 120 },
      });

      expect(prismaMock.client.leadActivity.create).toHaveBeenCalledWith({
        data: {
          leadId: 'lead_1',
          tenantId,
          type: ActivityType.STATUS_CHANGED,
          fromStatus: 'NEW',
          toStatus: 'CONTACTED',
          actorUserId,
          message: 'Customer reached via phone',
          metadata: { callDurationSec: 120 },
        },
      });
    });

    it('uses provided transaction client when passed', async () => {
      const txMock = {
        leadActivity: {
          create: jest.fn().mockResolvedValue({ id: 'la_tx_1' }),
        },
      };

      await service.recordLeadActivity(
        'lead_1',
        {
          tenantId,
          type: ActivityType.CREATED,
        },
        txMock as never,
      );

      expect(txMock.leadActivity.create).toHaveBeenCalledWith({
        data: {
          leadId: 'lead_1',
          tenantId,
          type: ActivityType.CREATED,
          fromStatus: null,
          toStatus: null,
          actorUserId: null,
          message: null,
          metadata: {},
        },
      });
      expect(prismaMock.client.leadActivity.create).not.toHaveBeenCalled();
    });

    it('swallows errors when creating lead activity fails', async () => {
      prismaMock.client.leadActivity.create.mockRejectedValue(new Error('DB insert failure'));

      await expect(
        service.recordLeadActivity('lead_1', {
          tenantId,
          type: ActivityType.NOTE_ADDED,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('recordBookingActivity', () => {
    it('creates a BookingActivity row using default prisma client', async () => {
      await service.recordBookingActivity('booking_1', {
        tenantId,
        type: ActivityType.STATUS_CHANGED,
        actorUserId,
        fromStatus: 'PENDING',
        toStatus: 'ASSIGNED',
        message: 'Assigned to tech',
        metadata: { technicianId: 'tech_10' },
      });

      expect(prismaMock.client.bookingActivity.create).toHaveBeenCalledWith({
        data: {
          bookingId: 'booking_1',
          tenantId,
          type: ActivityType.STATUS_CHANGED,
          fromStatus: 'PENDING',
          toStatus: 'ASSIGNED',
          actorUserId,
          message: 'Assigned to tech',
          metadata: { technicianId: 'tech_10' },
        },
      });
    });

    it('uses provided transaction client when passed', async () => {
      const txMock = {
        bookingActivity: {
          create: jest.fn().mockResolvedValue({ id: 'ba_tx_1' }),
        },
      };

      await service.recordBookingActivity(
        'booking_1',
        {
          tenantId,
          type: ActivityType.RESCHEDULED,
        },
        txMock as never,
      );

      expect(txMock.bookingActivity.create).toHaveBeenCalledWith({
        data: {
          bookingId: 'booking_1',
          tenantId,
          type: ActivityType.RESCHEDULED,
          fromStatus: null,
          toStatus: null,
          actorUserId: null,
          message: null,
          metadata: {},
        },
      });
      expect(prismaMock.client.bookingActivity.create).not.toHaveBeenCalled();
    });

    it('swallows errors when creating booking activity fails', async () => {
      prismaMock.client.bookingActivity.create.mockRejectedValue(new Error('DB insert failure'));

      await expect(
        service.recordBookingActivity('booking_1', {
          tenantId,
          type: ActivityType.FIELD_UPDATED,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('listLeadActivities', () => {
    it('fetches lead activities with descending order and actor details', async () => {
      const mockActivities = [{ id: 'la_1', message: 'First' }];
      prismaMock.client.leadActivity.findMany.mockResolvedValue(mockActivities);

      const result = await service.listLeadActivities('lead_1', 20);

      expect(prismaMock.client.leadActivity.findMany).toHaveBeenCalledWith({
        where: { leadId: 'lead_1' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          actor: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      });
      expect(result).toBe(mockActivities);
    });
  });

  describe('listBookingActivities', () => {
    it('fetches booking activities with descending order and actor details', async () => {
      const mockActivities = [{ id: 'ba_1', message: 'First' }];
      prismaMock.client.bookingActivity.findMany.mockResolvedValue(mockActivities);

      const result = await service.listBookingActivities('booking_1', 30);

      expect(prismaMock.client.bookingActivity.findMany).toHaveBeenCalledWith({
        where: { bookingId: 'booking_1' },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          actor: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      });
      expect(result).toBe(mockActivities);
    });
  });
});

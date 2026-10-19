import { DomainEventName, TechnicianStatus } from '@ac/types';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { TechnicianAvailabilityService } from '../technician-availability.service';

describe('TechnicianAvailabilityService', () => {
  let service: TechnicianAvailabilityService;
  let prismaMock: {
    client: {
      technician: {
        findFirst: jest.Mock;
        findMany: jest.Mock;
        update: jest.Mock;
      };
      technicianShift: {
        create: jest.Mock;
        findFirst: jest.Mock;
        update: jest.Mock;
      };
    };
  };
  let trackingMock: Record<string, unknown>;
  let eventsMock: {
    publish: jest.Mock;
  };

  const actorUserId = 'user_tech_1';
  const technicianId = 'tech_1';
  const tenantId = 'tenant_1';
  const cityId = 'city_1';

  beforeEach(() => {
    prismaMock = {
      client: {
        technician: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
          update: jest.fn(),
        },
        technicianShift: {
          create: jest.fn().mockResolvedValue({ id: 'shift_1' }),
          findFirst: jest.fn().mockResolvedValue(null),
          update: jest.fn().mockResolvedValue({}),
        },
      },
    };
    trackingMock = {};
    eventsMock = {
      publish: jest.fn(),
    };

    service = new TechnicianAvailabilityService(
      prismaMock as never,
      trackingMock as never,
      eventsMock as never,
    );
  });

  describe('setStatus', () => {
    it('throws NotFoundException when technician does not exist', async () => {
      prismaMock.client.technician.findFirst.mockResolvedValue(null);

      await expect(
        service.setStatus(actorUserId, technicianId, TechnicianStatus.ONLINE),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when actor is not the assigned user of technician', async () => {
      prismaMock.client.technician.findFirst.mockResolvedValue({
        id: technicianId,
        tenantId,
        cityId,
        userId: 'different_user',
        status: TechnicianStatus.OFFLINE,
        onlineSince: null,
      });

      await expect(
        service.setStatus(actorUserId, technicianId, TechnicianStatus.ONLINE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns technician immediately without update when target status is identical', async () => {
      const tech = {
        id: technicianId,
        tenantId,
        cityId,
        userId: actorUserId,
        status: TechnicianStatus.ONLINE,
        onlineSince: new Date(),
      };
      prismaMock.client.technician.findFirst.mockResolvedValue(tech);

      const result = await service.setStatus(actorUserId, technicianId, TechnicianStatus.ONLINE);

      expect(result).toBe(tech);
      expect(prismaMock.client.technician.update).not.toHaveBeenCalled();
      expect(eventsMock.publish).not.toHaveBeenCalled();
    });

    it('rejects invalid status transitions with BadRequestException', async () => {
      prismaMock.client.technician.findFirst.mockResolvedValue({
        id: technicianId,
        tenantId,
        cityId,
        userId: actorUserId,
        status: TechnicianStatus.OFFLINE,
        onlineSince: null,
      });

      // OFFLINE cannot transition directly to WORKING
      await expect(
        service.setStatus(actorUserId, technicianId, TechnicianStatus.WORKING),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.client.technician.update).not.toHaveBeenCalled();
      expect(eventsMock.publish).not.toHaveBeenCalled();
    });

    it('opens a TechnicianShift and publishes TechnicianOnline when transitioning OFFLINE -> ONLINE', async () => {
      prismaMock.client.technician.findFirst.mockResolvedValue({
        id: technicianId,
        tenantId,
        cityId,
        userId: actorUserId,
        status: TechnicianStatus.OFFLINE,
        onlineSince: null,
      });

      const updatedTech = {
        id: technicianId,
        tenantId,
        cityId,
        userId: actorUserId,
        status: TechnicianStatus.ONLINE,
        onlineSince: expect.any(Date),
      };
      prismaMock.client.technician.update.mockResolvedValue(updatedTech);

      const result = await service.setStatus(actorUserId, technicianId, TechnicianStatus.ONLINE);

      expect(prismaMock.client.technicianShift.create).toHaveBeenCalledWith({
        data: {
          tenantId,
          technicianId,
          startedAt: expect.any(Date),
        },
      });

      expect(eventsMock.publish).toHaveBeenCalledWith(DomainEventName.TechnicianOnline, {
        technicianId,
        cityId,
      });

      expect(prismaMock.client.technician.update).toHaveBeenCalledWith({
        where: { id: technicianId },
        data: {
          status: TechnicianStatus.ONLINE,
          lastSeenAt: expect.any(Date),
          onlineSince: expect.any(Date),
        },
      });

      expect(eventsMock.publish).toHaveBeenCalledWith(DomainEventName.TechnicianStatusChanged, {
        technicianId,
        status: TechnicianStatus.ONLINE,
      });

      expect(result).toBe(updatedTech);
    });

    it('closes open shift and publishes TechnicianOffline when transitioning ONLINE -> OFFLINE', async () => {
      const shiftStartTime = new Date(Date.now() - 3600_000);
      prismaMock.client.technician.findFirst.mockResolvedValue({
        id: technicianId,
        tenantId,
        cityId,
        userId: actorUserId,
        status: TechnicianStatus.ONLINE,
        onlineSince: shiftStartTime,
      });

      prismaMock.client.technicianShift.findFirst.mockResolvedValue({
        id: 'shift_open_1',
        technicianId,
        startedAt: shiftStartTime,
        endedAt: null,
      });

      const updatedTech = {
        id: technicianId,
        status: TechnicianStatus.OFFLINE,
        onlineSince: null,
      };
      prismaMock.client.technician.update.mockResolvedValue(updatedTech);

      const result = await service.setStatus(actorUserId, technicianId, TechnicianStatus.OFFLINE);

      expect(prismaMock.client.technicianShift.update).toHaveBeenCalledWith({
        where: { id: 'shift_open_1' },
        data: {
          endedAt: expect.any(Date),
          durationMin: expect.any(Number),
          endReason: 'manual',
        },
      });

      expect(eventsMock.publish).toHaveBeenCalledWith(DomainEventName.TechnicianOffline, {
        technicianId,
        cityId,
        reason: 'manual',
      });

      expect(eventsMock.publish).toHaveBeenCalledWith(DomainEventName.TechnicianStatusChanged, {
        technicianId,
        status: TechnicianStatus.OFFLINE,
      });

      expect(result).toBe(updatedTech);
    });
  });

  describe('availabilityOverview', () => {
    it('categorises technicians into correct dispatch status buckets', async () => {
      prismaMock.client.technician.findMany.mockResolvedValue([
        { id: 't1', fullName: 'Tech 1', cityId, status: TechnicianStatus.AVAILABLE, _count: { bookings: 0 } },
        { id: 't2', fullName: 'Tech 2', cityId, status: TechnicianStatus.ON_BREAK, _count: { bookings: 0 } },
        { id: 't3', fullName: 'Tech 3', cityId, status: TechnicianStatus.UNREACHABLE, _count: { bookings: 0 } },
        { id: 't4', fullName: 'Tech 4', cityId, status: TechnicianStatus.OFFLINE, _count: { bookings: 0 } },
        { id: 't5', fullName: 'Tech 5', cityId, status: TechnicianStatus.WORKING, _count: { bookings: 1 } },
      ]);

      const overview = await service.availabilityOverview(tenantId, cityId);

      expect(overview.buckets).toEqual({
        available: 1,
        engaged: 1,
        onBreak: 1,
        offline: 1,
        unreachable: 1,
      });
      expect(overview.technicians).toHaveLength(5);
    });
  });

  describe('sweepStaleTechnicians', () => {
    it('flips stale technicians to UNREACHABLE and auto-closes very stale shifts', async () => {
      const pastSeen = new Date(Date.now() - 5 * 60_000);
      const veryPastSeen = new Date(Date.now() - 40 * 60_000);

      // Stale findMany
      prismaMock.client.technician.findMany
        .mockResolvedValueOnce([
          { id: 't_stale', tenantId, cityId, status: TechnicianStatus.ONLINE, lastSeenAt: pastSeen, onlineSince: pastSeen },
        ])
        // Very stale findMany
        .mockResolvedValueOnce([
          { id: 't_verystale', tenantId, cityId, status: TechnicianStatus.UNREACHABLE, lastSeenAt: veryPastSeen, onlineSince: veryPastSeen },
        ]);

      prismaMock.client.technicianShift.findFirst.mockResolvedValue({
        id: 'shift_verystale',
        technicianId: 't_verystale',
        startedAt: veryPastSeen,
      });

      const r = await service.sweepStaleTechnicians();

      expect(r.flippedUnreachable).toBe(1);
      expect(r.closedShifts).toBe(1);

      expect(prismaMock.client.technician.update).toHaveBeenCalledWith({
        where: { id: 't_stale' },
        data: { status: TechnicianStatus.UNREACHABLE },
      });
      expect(eventsMock.publish).toHaveBeenCalledWith(DomainEventName.TechnicianUnreachable, {
        technicianId: 't_stale',
        lastSeenAt: pastSeen.toISOString(),
      });

      expect(prismaMock.client.technician.update).toHaveBeenCalledWith({
        where: { id: 't_verystale' },
        data: { status: TechnicianStatus.OFFLINE, onlineSince: null },
      });
      expect(eventsMock.publish).toHaveBeenCalledWith(DomainEventName.TechnicianOffline, {
        technicianId: 't_verystale',
        cityId,
        reason: 'timeout',
      });
    });

    it('returns 0s when no technicians are stale', async () => {
      prismaMock.client.technician.findMany.mockResolvedValueOnce([]);

      const r = await service.sweepStaleTechnicians();

      expect(r).toEqual({ flippedUnreachable: 0, closedShifts: 0 });
      expect(prismaMock.client.technician.update).not.toHaveBeenCalled();
    });
  });
});

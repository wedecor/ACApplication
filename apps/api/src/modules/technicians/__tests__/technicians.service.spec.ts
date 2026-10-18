import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CommissionType, ServiceCategory, UserStatus } from '@ac/types';

import { TechniciansService } from '../technicians.service';

const actor = {
  userId: 'admin_1',
  tenantId: 'tenant_1',
  sessionId: 's',
  roles: [],
  permissions: [],
  email: null,
  phone: null,
  permissionVersion: 1,
  iat: 0,
  exp: 0,
};

function buildPrisma() {
  const tx = {
    user: { create: jest.fn().mockResolvedValue({ id: 'user_t1' }), update: jest.fn() },
    technician: {
      create: jest.fn().mockResolvedValue({ id: 'tech_1' }),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(4),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    userRoleAssignment: { create: jest.fn() },
    session: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
  };
  const client = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    city: { findFirst: jest.fn().mockResolvedValue({ id: 'city_1' }), findMany: jest.fn() },
    user: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
    role: { findUnique: jest.fn().mockResolvedValue({ id: 'role_tech' }) },
    technician: {
      findFirst: jest.fn(),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    booking: { count: jest.fn().mockResolvedValue(0) },
    technicianCommissionRule: { upsert: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
  };
  return { client, tx };
}

function build() {
  const { client, tx } = buildPrisma();
  const service = new TechniciansService({ client } as never);
  return { service, client, tx };
}

describe('TechniciansService', () => {
  describe('getSelf', () => {
    it("returns the caller's technician row scoped to their user and tenant", async () => {
      const { service, client } = build();
      client.technician.findFirst.mockResolvedValue({ id: 'tech_1', fullName: 'Ravi Kumar' });

      await expect(service.getSelf(actor as never)).resolves.toMatchObject({ id: 'tech_1' });
      expect(client.technician.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'admin_1', tenantId: 'tenant_1', deletedAt: null } }),
      );
    });

    it('throws NotFound when the user has no technician profile', async () => {
      const { service, client } = build();
      client.technician.findFirst.mockResolvedValue(null);

      await expect(service.getSelf(actor as never)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    const dto = {
      firstName: 'Ravi',
      lastName: 'Kumar',
      phone: '+919800000001',
      cityId: 'city_1',
      skills: [ServiceCategory.AC_REPAIR],
    };

    it('creates user + technician + role assignment in one transaction with generated code', async () => {
      const { service, client, tx } = build();
      const detail = jest.spyOn(service, 'getById').mockResolvedValue({ id: 'tech_1' } as never);

      await service.create(actor as never, dto);

      expect(client.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            phone: dto.phone,
            status: UserStatus.ACTIVE,
            authProvider: 'OTP',
            createdBy: actor.userId,
          }),
        }),
      );
      expect(tx.technician.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user_t1',
            employeeCode: 'TECH-00005',
            fullName: 'Ravi Kumar',
            dailyCapacity: 8,
          }),
        }),
      );
      expect(tx.userRoleAssignment.create).toHaveBeenCalledWith({
        data: { userId: 'user_t1', roleId: 'role_tech', assignedBy: actor.userId },
      });
      expect(detail).toHaveBeenCalledWith(actor, 'tech_1');
    });

    it('rejects a phone that already belongs to a user', async () => {
      const { service, client } = build();
      client.user.findUnique.mockResolvedValueOnce({ id: 'someone' });
      await expect(service.create(actor as never, dto)).rejects.toBeInstanceOf(ConflictException);
      expect(client.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an inactive / foreign city', async () => {
      const { service, client } = build();
      client.city.findFirst.mockResolvedValueOnce(null);
      await expect(service.create(actor as never, dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects malformed working hours', async () => {
      const { service } = build();
      await expect(
        service.create(actor as never, { ...dto, workingHours: { mon: [['18:00', '09:00']] } }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('deactivate', () => {
    it('blocks when open bookings exist and force is not set', async () => {
      const { service, client } = build();
      client.technician.findFirst.mockResolvedValue({
        id: 'tech_1',
        userId: 'user_t1',
        user: { status: UserStatus.ACTIVE },
      });
      client.booking.count.mockResolvedValue(3);
      await expect(service.deactivate(actor as never, 'tech_1', {})).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(client.$transaction).not.toHaveBeenCalled();
    });

    it('suspends the user, forces OFFLINE and revokes sessions when forced', async () => {
      const { service, client, tx } = build();
      client.technician.findFirst.mockResolvedValue({
        id: 'tech_1',
        userId: 'user_t1',
        user: { status: UserStatus.ACTIVE },
      });
      client.booking.count.mockResolvedValue(1);

      const result = await service.deactivate(actor as never, 'tech_1', { force: true });

      expect(tx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: UserStatus.SUSPENDED, updatedBy: actor.userId } }),
      );
      expect(tx.technician.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'OFFLINE', onlineSince: null } }),
      );
      expect(result).toMatchObject({ openBookingsLeftAssigned: 1, sessionsRevoked: 2 });
    });

    it('404s for technicians outside the tenant', async () => {
      const { service, client } = build();
      client.technician.findFirst.mockResolvedValue(null);
      await expect(service.deactivate(actor as never, 'x', {})).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('reactivate', () => {
    it('refuses when already active', async () => {
      const { service, client } = build();
      client.technician.findFirst.mockResolvedValue({
        id: 'tech_1',
        userId: 'user_t1',
        user: { status: UserStatus.ACTIVE },
      });
      await expect(service.reactivate(actor as never, 'tech_1')).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('upsertCommissionRule', () => {
    it('rejects percentages above 100%', async () => {
      const { service, client } = build();
      client.technician.findFirst.mockResolvedValue({ id: 'tech_1' });
      await expect(
        service.upsertCommissionRule(actor as never, 'tech_1', {
          type: CommissionType.PERCENTAGE,
          valueMinor: 12_000,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('applies defaults on upsert', async () => {
      const { service, client } = build();
      client.technician.findFirst.mockResolvedValue({ id: 'tech_1' });
      client.technicianCommissionRule.upsert.mockResolvedValue({ id: 'r1' });
      const res = await service.upsertCommissionRule(actor as never, 'tech_1', {
        type: CommissionType.FLAT,
        valueMinor: 30_000,
      });
      expect(client.technicianCommissionRule.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ tenantId: 'tenant_1', bonusMinor: 0, payoutCycle: 'WEEKLY', cycleClosesOn: 6 }),
        }),
      );
      expect(res.isDefault).toBe(false);
    });
  });
});

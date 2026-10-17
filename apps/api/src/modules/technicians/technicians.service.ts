import type { AuthPrincipal } from '@ac/auth';
import {
  BookingStatus,
  CommissionType,
  PayoutCycle,
  ServiceCategory,
  TechnicianStatus,
  UserRole,
  UserStatus,
} from '@ac/types';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AuthProvider, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  CreateTechnicianDto,
  DeactivateTechnicianDto,
  ListTechniciansDto,
  ListTechnicianSubresourceDto,
  TechnicianDocumentDto,
  UpdateTechnicianDto,
  UpsertTechnicianCommissionRuleDto,
} from './dto/technician.dto';
import { TECHNICIAN_SORT_FIELDS } from './dto/technician.dto';
import {
  buildFullName,
  computeCompletionRate,
  formatEmployeeCode,
  OPEN_BOOKING_STATUSES,
  validateWorkingHours,
} from './technician.helpers';

const MAX_PERCENTAGE_BPS = 10_000;
const RECENT_LIMIT = 10;

const USER_SELECT = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  createdBy: true,
  updatedBy: true,
} satisfies Prisma.UserSelect;

const LIST_SELECT = {
  id: true,
  userId: true,
  employeeCode: true,
  fullName: true,
  phone: true,
  skills: true,
  rating: true,
  totalJobs: true,
  acceptanceRate: true,
  completionRate: true,
  dailyCapacity: true,
  status: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
  city: { select: { id: true, name: true, state: true } },
  user: { select: { id: true, email: true, status: true, lastLoginAt: true } },
} satisfies Prisma.TechnicianSelect;

/** Presence states a technician is forced out of when their account is disabled. */
const OFFLINE_ON_DEACTIVATE = TechnicianStatus.OFFLINE;

@Injectable()
export class TechniciansService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------ meta
  async formOptions(actor: AuthPrincipal) {
    const cities = await this.prisma.client.city.findMany({
      where: { tenantId: actor.tenantId, isActive: true },
      select: { id: true, name: true, state: true },
      orderBy: { name: 'asc' },
    });
    return {
      cities,
      skills: Object.values(ServiceCategory),
      commissionTypes: Object.values(CommissionType),
      payoutCycles: Object.values(PayoutCycle),
    };
  }

  // ------------------------------------------------------------------ list
  async list(actor: AuthPrincipal, query: ListTechniciansDto) {
    const where: Prisma.TechnicianWhereInput = { tenantId: actor.tenantId };
    if (query.cityId) where.cityId = query.cityId;
    if (query.status?.length) where.status = { in: query.status };
    if (query.skill?.length) where.skills = { hasSome: query.skill };
    if (query.accountStatus) where.user = { status: query.accountStatus };
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.client.technician.findMany({
        where,
        select: {
          ...LIST_SELECT,
          _count: {
            select: { bookings: { where: { status: { in: OPEN_BOOKING_STATUSES }, deletedAt: null } } },
          },
        },
        orderBy: parseSort(query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.client.technician.count({ where }),
    ]);

    return {
      items: items.map(({ _count, ...t }) => ({ ...t, openBookings: _count.bookings })),
      total,
    };
  }

  // ---------------------------------------------------------------- detail
  async getById(actor: AuthPrincipal, id: string) {
    const technician = await this.prisma.client.technician.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: {
        ...LIST_SELECT,
        workingHours: true,
        documents: true,
        onlineSince: true,
        lastLocationAt: true,
        lastBatteryPct: true,
        user: { select: USER_SELECT },
      },
    });
    if (!technician) throw new NotFoundException('Technician not found');

    const bookingWhere = { technicianId: id, tenantId: actor.tenantId };
    const ratingWhere = { technicianId: id, tenantId: actor.tenantId, deletedAt: null };

    const [statusCounts, ratingAgg, ratingBuckets, recentBookings, recentRatings, commissionRule] =
      await Promise.all([
        this.prisma.client.booking.groupBy({
          by: ['status'],
          where: { ...bookingWhere, deletedAt: null },
          _count: { _all: true },
        }),
        this.prisma.client.bookingRating.aggregate({
          where: ratingWhere,
          _avg: { value: true },
          _count: { _all: true },
        }),
        this.prisma.client.bookingRating.groupBy({
          by: ['value'],
          where: ratingWhere,
          _count: { _all: true },
        }),
        this.prisma.client.booking.findMany({
          where: bookingWhere,
          select: BOOKING_SUMMARY_SELECT,
          orderBy: { scheduledAt: 'desc' },
          take: RECENT_LIMIT,
        }),
        this.prisma.client.bookingRating.findMany({
          where: ratingWhere,
          select: RATING_SELECT,
          orderBy: { createdAt: 'desc' },
          take: RECENT_LIMIT,
        }),
        this.prisma.client.technicianCommissionRule.findUnique({ where: { technicianId: id } }),
      ]);

    const byStatus = Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])) as Partial<
      Record<BookingStatus, number>
    >;
    const completed = byStatus[BookingStatus.COMPLETED] ?? 0;
    const cancelled = byStatus[BookingStatus.CANCELLED] ?? 0;
    const noShow = byStatus[BookingStatus.NO_SHOW] ?? 0;
    const openBookings = OPEN_BOOKING_STATUSES.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0);
    const ratingCount = ratingAgg._count._all;
    const ratingAverage = ratingAgg._avg.value ?? null;

    return {
      ...technician,
      hasCustomCommissionRule: commissionRule !== null,
      stats: {
        totalJobs: Math.max(technician.totalJobs, completed),
        completedJobs: completed,
        cancelledJobs: cancelled,
        noShowJobs: noShow,
        openBookings,
        bookingsByStatus: byStatus,
        rating: ratingAverage !== null ? Math.round(ratingAverage * 100) / 100 : technician.rating,
        ratingCount,
        ratingDistribution: [1, 2, 3, 4, 5].map((value) => ({
          value,
          count: ratingBuckets.find((b) => b.value === value)?._count._all ?? 0,
        })),
        acceptanceRate: technician.acceptanceRate,
        completionRate: computeCompletionRate({ completed, cancelled, noShow }, technician.completionRate),
      },
      recentBookings,
      recentRatings,
    };
  }

  async listBookings(actor: AuthPrincipal, id: string, query: ListTechnicianSubresourceDto) {
    await this.assertExists(actor, id);
    const where: Prisma.BookingWhereInput = { technicianId: id, tenantId: actor.tenantId };
    const [items, total] = await Promise.all([
      this.prisma.client.booking.findMany({
        where,
        select: BOOKING_SUMMARY_SELECT,
        orderBy: { scheduledAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.client.booking.count({ where }),
    ]);
    return { items, total };
  }

  async listRatings(actor: AuthPrincipal, id: string, query: ListTechnicianSubresourceDto) {
    await this.assertExists(actor, id);
    const where: Prisma.BookingRatingWhereInput = {
      technicianId: id,
      tenantId: actor.tenantId,
      deletedAt: null,
    };
    const [items, total] = await Promise.all([
      this.prisma.client.bookingRating.findMany({
        where,
        select: RATING_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.client.bookingRating.count({ where }),
    ]);
    return { items, total };
  }

  // ---------------------------------------------------------------- create
  /**
   * Onboards a technician: User (phone/OTP login, ACTIVE) + Technician profile
   * + TECHNICIAN role assignment, atomically.
   */
  async create(actor: AuthPrincipal, dto: CreateTechnicianDto) {
    assertWorkingHours(dto.workingHours);
    await this.assertCity(actor, dto.cityId);
    await this.assertPhoneAvailable(dto.phone);
    if (dto.email) await this.assertEmailAvailable(dto.email);
    if (dto.employeeCode) await this.assertEmployeeCodeAvailable(dto.employeeCode);

    const role = await this.prisma.client.role.findUnique({
      where: { tenantId_key: { tenantId: actor.tenantId, key: UserRole.TECHNICIAN } },
      select: { id: true },
    });
    if (!role) {
      throw new InternalServerErrorException('TECHNICIAN role is not provisioned for this tenant — run RBAC sync.');
    }

    try {
      const created = await this.prisma.client.$transaction(async (tx) => {
        const employeeCode = dto.employeeCode ?? (await this.nextEmployeeCode(tx));
        const user = await tx.user.create({
          data: {
            tenantId: actor.tenantId,
            phone: dto.phone,
            email: dto.email ?? null,
            firstName: dto.firstName,
            lastName: dto.lastName ?? null,
            status: UserStatus.ACTIVE,
            authProvider: AuthProvider.OTP,
            createdBy: actor.userId,
            updatedBy: actor.userId,
          },
          select: { id: true },
        });
        const technician = await tx.technician.create({
          data: {
            tenantId: actor.tenantId,
            userId: user.id,
            cityId: dto.cityId,
            employeeCode,
            fullName: buildFullName(dto.firstName, dto.lastName),
            phone: dto.phone,
            skills: dto.skills,
            dailyCapacity: dto.dailyCapacity ?? 8,
            workingHours: (dto.workingHours ?? {}),
            documents: serializeDocuments(dto.documents ?? []),
            status: TechnicianStatus.OFFLINE,
          },
          select: { id: true },
        });
        await tx.userRoleAssignment.create({
          data: { userId: user.id, roleId: role.id, assignedBy: actor.userId },
        });
        return technician;
      });
      return await this.getById(actor, created.id);
    } catch (err) {
      throw mapUniqueViolation(err);
    }
  }

  // ---------------------------------------------------------------- update
  async update(actor: AuthPrincipal, id: string, dto: UpdateTechnicianDto) {
    const current = await this.prisma.client.technician.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: {
        id: true,
        userId: true,
        phone: true,
        employeeCode: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    if (!current) throw new NotFoundException('Technician not found');

    if (dto.workingHours !== undefined) assertWorkingHours(dto.workingHours);
    if (dto.cityId) await this.assertCity(actor, dto.cityId);
    if (dto.phone && dto.phone !== current.phone) await this.assertPhoneAvailable(dto.phone, current.userId);
    if (dto.email && dto.email !== current.user.email) await this.assertEmailAvailable(dto.email, current.userId);
    if (dto.employeeCode && dto.employeeCode !== current.employeeCode) {
      await this.assertEmployeeCodeAvailable(dto.employeeCode);
    }

    const nameChanged = dto.firstName !== undefined || dto.lastName !== undefined;
    const firstName = dto.firstName ?? current.user.firstName ?? '';
    const lastName = dto.lastName !== undefined ? dto.lastName : current.user.lastName;

    try {
      await this.prisma.client.$transaction(async (tx) => {
        const userData: Prisma.UserUpdateInput = { updatedBy: actor.userId };
        if (dto.firstName !== undefined) userData.firstName = dto.firstName;
        if (dto.lastName !== undefined) userData.lastName = dto.lastName || null;
        if (dto.phone !== undefined) userData.phone = dto.phone;
        if (dto.email !== undefined) userData.email = dto.email || null;
        await tx.user.update({ where: { id: current.userId }, data: userData, select: { id: true } });

        const techData: Prisma.TechnicianUpdateInput = {};
        if (nameChanged) techData.fullName = buildFullName(firstName, lastName);
        if (dto.phone !== undefined) techData.phone = dto.phone;
        if (dto.cityId !== undefined) techData.city = { connect: { id: dto.cityId } };
        if (dto.employeeCode !== undefined) techData.employeeCode = dto.employeeCode;
        if (dto.skills !== undefined) techData.skills = dto.skills;
        if (dto.dailyCapacity !== undefined) techData.dailyCapacity = dto.dailyCapacity;
        if (dto.workingHours !== undefined) techData.workingHours = dto.workingHours;
        if (dto.documents !== undefined) techData.documents = serializeDocuments(dto.documents);
        if (Object.keys(techData).length > 0) {
          await tx.technician.update({ where: { id }, data: techData, select: { id: true } });
        }
      });
    } catch (err) {
      throw mapUniqueViolation(err);
    }
    return this.getById(actor, id);
  }

  // ------------------------------------------------- deactivate / reactivate
  async deactivate(actor: AuthPrincipal, id: string, dto: DeactivateTechnicianDto) {
    const tech = await this.prisma.client.technician.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: { id: true, userId: true, user: { select: { status: true } } },
    });
    if (!tech) throw new NotFoundException('Technician not found');
    if (tech.userId === actor.userId) {
      throw new BadRequestException('You cannot deactivate your own account');
    }
    if (tech.user.status === UserStatus.SUSPENDED) {
      throw new ConflictException('Technician is already deactivated');
    }

    const openBookings = await this.prisma.client.booking.count({
      where: { technicianId: id, tenantId: actor.tenantId, status: { in: OPEN_BOOKING_STATUSES } },
    });
    if (openBookings > 0 && !dto.force) {
      throw new ConflictException({
        code: 'TECHNICIAN_HAS_OPEN_BOOKINGS',
        message: `Technician has ${openBookings} open booking(s). Reassign them first or pass force=true.`,
        details: { openBookings },
      });
    }

    const now = new Date();
    const revoked = await this.prisma.client.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: tech.userId },
        data: { status: UserStatus.SUSPENDED, updatedBy: actor.userId },
        select: { id: true },
      });
      await tx.technician.update({
        where: { id },
        data: { status: OFFLINE_ON_DEACTIVATE, onlineSince: null },
        select: { id: true },
      });
      const sessions = await tx.session.updateMany({
        where: { userId: tech.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      return sessions.count;
    });

    return {
      id,
      accountStatus: UserStatus.SUSPENDED,
      openBookingsLeftAssigned: openBookings,
      sessionsRevoked: revoked,
      reason: dto.reason ?? null,
    };
  }

  async reactivate(actor: AuthPrincipal, id: string) {
    const tech = await this.prisma.client.technician.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: { id: true, userId: true, user: { select: { status: true } } },
    });
    if (!tech) throw new NotFoundException('Technician not found');
    if (tech.user.status === UserStatus.ACTIVE) {
      throw new ConflictException('Technician is already active');
    }
    await this.prisma.client.user.update({
      where: { id: tech.userId },
      data: { status: UserStatus.ACTIVE, updatedBy: actor.userId },
      select: { id: true },
    });
    return { id, accountStatus: UserStatus.ACTIVE };
  }

  // -------------------------------------------------------- commission rule
  async getCommissionRule(actor: AuthPrincipal, id: string) {
    await this.assertExists(actor, id);
    const rule = await this.prisma.client.technicianCommissionRule.findUnique({
      where: { technicianId: id },
    });
    return { technicianId: id, isDefault: rule === null, rule };
  }

  async upsertCommissionRule(actor: AuthPrincipal, id: string, dto: UpsertTechnicianCommissionRuleDto) {
    await this.assertExists(actor, id);
    if (dto.type === CommissionType.PERCENTAGE && dto.valueMinor > MAX_PERCENTAGE_BPS) {
      throw new BadRequestException('PERCENTAGE commission is in basis points and cannot exceed 10000 (100%)');
    }
    const data = {
      type: dto.type,
      valueMinor: dto.valueMinor,
      bonusMinor: dto.bonusMinor ?? 0,
      penaltyPerLateMinuteMinor: dto.penaltyPerLateMinuteMinor ?? 0,
      minPayoutMinor: dto.minPayoutMinor ?? 0,
      payoutCycle: dto.payoutCycle ?? PayoutCycle.WEEKLY,
      cycleClosesOn: dto.cycleClosesOn ?? 6,
    };
    const rule = await this.prisma.client.technicianCommissionRule.upsert({
      where: { technicianId: id },
      update: data,
      create: { tenantId: actor.tenantId, technicianId: id, ...data },
    });
    return { technicianId: id, isDefault: false, rule };
  }

  /** Removes the per-technician override; payouts fall back to the default rule. */
  async deleteCommissionRule(actor: AuthPrincipal, id: string) {
    await this.assertExists(actor, id);
    const existing = await this.prisma.client.technicianCommissionRule.findUnique({
      where: { technicianId: id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Technician has no custom commission rule');
    await this.prisma.client.technicianCommissionRule.delete({ where: { technicianId: id } });
    return { technicianId: id, isDefault: true, rule: null };
  }

  // --------------------------------------------------------------- helpers
  private async assertExists(actor: AuthPrincipal, id: string): Promise<void> {
    const found = await this.prisma.client.technician.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Technician not found');
  }

  private async assertCity(actor: AuthPrincipal, cityId: string): Promise<void> {
    const city = await this.prisma.client.city.findFirst({
      where: { id: cityId, tenantId: actor.tenantId, isActive: true },
      select: { id: true },
    });
    if (!city) throw new BadRequestException('cityId does not reference an active city');
  }

  private async assertPhoneAvailable(phone: string, exceptUserId?: string): Promise<void> {
    // findUnique bypasses the soft-delete filter — phone is globally unique.
    const existing = await this.prisma.client.user.findUnique({ where: { phone }, select: { id: true } });
    if (existing && existing.id !== exceptUserId) {
      throw new ConflictException('A user with this phone number already exists');
    }
  }

  private async assertEmailAvailable(email: string, exceptUserId?: string): Promise<void> {
    const existing = await this.prisma.client.user.findUnique({ where: { email }, select: { id: true } });
    if (existing && existing.id !== exceptUserId) {
      throw new ConflictException('A user with this email already exists');
    }
  }

  private async assertEmployeeCodeAvailable(employeeCode: string): Promise<void> {
    const existing = await this.prisma.client.technician.findUnique({
      where: { employeeCode },
      select: { id: true },
    });
    if (existing) throw new ConflictException('employeeCode is already in use');
  }

  private async nextEmployeeCode(tx: Prisma.TransactionClient): Promise<string> {
    let seq = (await tx.technician.count({ where: { employeeCode: { startsWith: 'TECH-' } } })) + 1;
    for (let attempt = 0; attempt < 50; attempt++, seq++) {
      const code = formatEmployeeCode(seq);
      // findUnique is not soft-delete filtered, so retired codes are never reused.
      const taken = await tx.technician.findUnique({ where: { employeeCode: code }, select: { id: true } });
      if (!taken) return code;
    }
    throw new ConflictException('Could not allocate an employee code — please supply one explicitly');
  }
}

const BOOKING_SUMMARY_SELECT = {
  id: true,
  code: true,
  status: true,
  category: true,
  serviceType: true,
  scheduledAt: true,
  scheduledTimeSlot: true,
  completedAt: true,
  finalAmountMinor: true,
  estimatedAmountMinor: true,
  currency: true,
  customer: { select: { id: true, fullName: true } },
  city: { select: { id: true, name: true } },
} satisfies Prisma.BookingSelect;

const RATING_SELECT = {
  id: true,
  bookingId: true,
  value: true,
  npsScore: true,
  comment: true,
  createdAt: true,
  booking: { select: { id: true, code: true, category: true } },
  customer: { select: { id: true, fullName: true } },
} satisfies Prisma.BookingRatingSelect;

function parseSort(sort: string | undefined): Prisma.TechnicianOrderByWithRelationInput {
  const [field, dir] = (sort ?? 'createdAt:desc').split(':');
  const key = (TECHNICIAN_SORT_FIELDS as readonly string[]).includes(field ?? '') ? field! : 'createdAt';
  return { [key]: dir === 'asc' ? 'asc' : 'desc' };
}

function assertWorkingHours(value: unknown): void {
  if (value === undefined) return;
  const errors = validateWorkingHours(value);
  if (errors.length) throw new BadRequestException({ message: 'Invalid workingHours', details: errors });
}

function serializeDocuments(docs: TechnicianDocumentDto[]): Prisma.InputJsonValue {
  return docs.map((d) => ({
    type: d.type,
    url: d.url,
    label: d.label ?? null,
    expiresAt: d.expiresAt ?? null,
    verified: d.verified ?? false,
  }));
}

function mapUniqueViolation(err: unknown): unknown {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    const target = (err.meta?.target as string[] | string | undefined) ?? 'field';
    return new ConflictException(`Duplicate value for ${Array.isArray(target) ? target.join(', ') : target}`);
  }
  return err;
}

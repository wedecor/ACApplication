import type { AuthPrincipal } from '@ac/auth';
import type { Prisma } from '@ac/database';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { BookingsService } from '../../bookings/bookings.service';
import type { CreateBookingDto } from '../../bookings/dto/create-booking.dto';
import { AppliancesService } from '../appliances/appliances.service';
import { RepairEventName } from '../domain/events';
import { nextRepairNumberTx } from '../domain/numbering';
import { isWindowActive } from '../domain/warranty';
import { RepairEventsService } from '../repair-events.service';
import {
  CreateWarrantyClaimDto,
  DecideWarrantyClaimDto,
  ListWarrantyClaimsDto,
  ScheduleRevisitDto,
  UpdateOemClaimDto,
  WarrantyCheckDto,
} from './dto/warranty.dto';

const CLAIM_INCLUDE = {
  customer: { select: { id: true, fullName: true, phone: true } },
  appliance: {
    select: { id: true, category: true, brand: true, modelNumber: true, serialNumber: true },
  },
  originalBooking: {
    select: { id: true, code: true, status: true, completedAt: true, repairWarrantyUntil: true },
  },
  revisitBooking: { select: { id: true, code: true, status: true, scheduledAt: true } },
} satisfies Prisma.WarrantyClaimInclude;

/** Claims in these states block a second claim for the same original booking. */
const ACTIVE_CLAIM_STATUSES = ['OPEN', 'APPROVED', 'SUBMITTED_TO_OEM'] as const;

export interface WarrantyCheckResult {
  eligibleForRepairRevisit: boolean;
  repairWarrantyUntil: Date | null;
  originalBookingId: string | null;
  originalBookingCode: string | null;
  applianceId: string | null;
  manufacturerWarrantyActive: boolean;
  manufacturerWarrantyUntil: Date | null;
  extendedWarrantyActive: boolean;
  extendedWarrantyUntil: Date | null;
  amcCovered: boolean;
  existingClaimId: string | null;
  reason: string | null;
}

@Injectable()
export class WarrantyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appliances: AppliancesService,
    private readonly bookings: BookingsService,
    private readonly events: RepairEventsService,
  ) {}

  async check(actor: AuthPrincipal, query: WarrantyCheckDto): Promise<WarrantyCheckResult> {
    if (!query.bookingId && !query.applianceId) {
      throw new BadRequestException('bookingId or applianceId is required');
    }
    const now = new Date();

    let original: {
      id: string;
      code: string;
      status: string;
      repairWarrantyUntil: Date | null;
      applianceId: string | null;
    } | null = null;
    let applianceId = query.applianceId ?? null;

    if (query.bookingId) {
      original = await this.prisma.client.booking.findFirst({
        where: { id: query.bookingId, tenantId: actor.tenantId },
        select: { id: true, code: true, status: true, repairWarrantyUntil: true, applianceId: true },
      });
      if (!original) throw new NotFoundException('Booking not found');
      applianceId = applianceId ?? original.applianceId;
    }

    const appliance = applianceId
      ? await this.prisma.client.customerAppliance.findFirst({
          where: { id: applianceId, tenantId: actor.tenantId, deletedAt: null },
          select: {
            id: true,
            customerId: true,
            category: true,
            manufacturerWarrantyUntil: true,
            extendedWarrantyUntil: true,
          },
        })
      : null;
    if (query.applianceId && !appliance) throw new NotFoundException('Appliance not found');

    if (!original && appliance) {
      const latest = await this.appliances.latestRepairWarranty(actor.tenantId, appliance.id);
      if (latest) {
        original = {
          id: latest.id,
          code: latest.code,
          status: 'COMPLETED',
          repairWarrantyUntil: latest.repairWarrantyUntil,
          applianceId: appliance.id,
        };
      }
    }

    const existingClaim = original
      ? await this.prisma.client.warrantyClaim.findFirst({
          where: {
            tenantId: actor.tenantId,
            originalBookingId: original.id,
            type: 'REPAIR_REVISIT',
            deletedAt: null,
            status: { in: [...ACTIVE_CLAIM_STATUSES] },
          },
          select: { id: true },
        })
      : null;

    const amcCovered = appliance ? await this.appliances.isAmcCovered(actor.tenantId, appliance, now) : false;

    let reason: string | null = null;
    if (!original) reason = 'No completed repair on record';
    else if (original.status !== 'COMPLETED') reason = 'Original booking is not completed';
    else if (!isWindowActive(original.repairWarrantyUntil, now)) reason = 'Repair warranty has expired';
    else if (existingClaim) reason = 'A warranty claim is already open for this booking';

    return {
      eligibleForRepairRevisit: reason === null,
      repairWarrantyUntil: original?.repairWarrantyUntil ?? null,
      originalBookingId: original?.id ?? null,
      originalBookingCode: original?.code ?? null,
      applianceId: appliance?.id ?? null,
      manufacturerWarrantyActive: isWindowActive(appliance?.manufacturerWarrantyUntil, now),
      manufacturerWarrantyUntil: appliance?.manufacturerWarrantyUntil ?? null,
      extendedWarrantyActive: isWindowActive(appliance?.extendedWarrantyUntil, now),
      extendedWarrantyUntil: appliance?.extendedWarrantyUntil ?? null,
      amcCovered,
      existingClaimId: existingClaim?.id ?? null,
      reason,
    };
  }

  async list(actor: AuthPrincipal, query: ListWarrantyClaimsDto) {
    const where: Prisma.WarrantyClaimWhereInput = {
      tenantId: actor.tenantId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.applianceId ? { applianceId: query.applianceId } : {}),
      ...(query.search
        ? {
            OR: [
              { number: { contains: query.search, mode: 'insensitive' } },
              { customer: { fullName: { contains: query.search, mode: 'insensitive' } } },
              { customer: { phone: { contains: query.search } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.warrantyClaim.findMany({
        where,
        include: CLAIM_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.client.warrantyClaim.count({ where }),
    ]);
    return { items, total };
  }

  async get(actor: AuthPrincipal, id: string) {
    const claim = await this.prisma.client.warrantyClaim.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
      include: CLAIM_INCLUDE,
    });
    if (!claim) throw new NotFoundException('Warranty claim not found');
    return claim;
  }

  async create(actor: AuthPrincipal, dto: CreateWarrantyClaimDto) {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: dto.customerId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const appliance = dto.applianceId
      ? await this.prisma.client.customerAppliance.findFirst({
          where: { id: dto.applianceId, tenantId: actor.tenantId, deletedAt: null },
          select: { id: true, customerId: true, brand: true },
        })
      : null;
    if (dto.applianceId && !appliance) throw new NotFoundException('Appliance not found');
    if (appliance && appliance.customerId !== dto.customerId) {
      throw new BadRequestException('Appliance does not belong to customer');
    }

    let originalBookingId = dto.originalBookingId ?? null;
    if (!originalBookingId && dto.type === 'REPAIR_REVISIT' && appliance) {
      originalBookingId =
        (await this.appliances.latestRepairWarranty(actor.tenantId, appliance.id))?.id ?? null;
    }
    const original = originalBookingId
      ? await this.prisma.client.booking.findFirst({
          where: { id: originalBookingId, tenantId: actor.tenantId },
          select: {
            id: true,
            customerId: true,
            status: true,
            repairWarrantyUntil: true,
            applianceId: true,
          },
        })
      : null;
    if (originalBookingId && !original) throw new NotFoundException('Original booking not found');
    if (original && original.customerId !== dto.customerId) {
      throw new BadRequestException('Original booking does not belong to customer');
    }

    if (dto.type === 'REPAIR_REVISIT') {
      if (!original) {
        throw new BadRequestException('originalBookingId is required for a repair revisit claim');
      }
      if (original.status !== 'COMPLETED') {
        throw new BadRequestException('Original booking is not completed');
      }
      if (!isWindowActive(original.repairWarrantyUntil)) {
        throw new BadRequestException({
          message: 'Repair warranty has expired for this booking',
          code: 'REPAIR_WARRANTY_EXPIRED',
        });
      }
      const dup = await this.prisma.client.warrantyClaim.findFirst({
        where: {
          tenantId: actor.tenantId,
          originalBookingId: original.id,
          type: 'REPAIR_REVISIT',
          deletedAt: null,
          status: { in: [...ACTIVE_CLAIM_STATUSES] },
        },
        select: { id: true, number: true },
      });
      if (dup) {
        throw new ConflictException({
          message: `Claim ${dup.number} is already open for this booking`,
          code: 'WARRANTY_CLAIM_EXISTS',
          claimId: dup.id,
        });
      }
    }

    const claim = await this.prisma.client.$transaction(async (tx) => {
      const number = await nextRepairNumberTx(tx, 'WC');
      return tx.warrantyClaim.create({
        data: {
          tenantId: actor.tenantId,
          number,
          type: dto.type,
          status: 'OPEN',
          customerId: dto.customerId,
          applianceId: appliance?.id ?? original?.applianceId ?? null,
          originalBookingId: original?.id ?? null,
          reason: dto.reason.trim(),
          description: dto.description?.trim() || null,
          oemName:
            dto.type === 'OEM_CLAIM' ? dto.oemName?.trim() || appliance?.brand || null : null,
          claimAmountMinor: dto.claimAmountMinor ?? 0,
          createdBy: actor.userId,
          updatedBy: actor.userId,
        },
        include: CLAIM_INCLUDE,
      });
    });

    this.events.publish(RepairEventName.WarrantyClaimCreated, {
      tenantId: actor.tenantId,
      claimId: claim.id,
      number: claim.number,
      type: claim.type,
      customerId: claim.customerId,
    });
    return claim;
  }

  async decide(actor: AuthPrincipal, id: string, dto: DecideWarrantyClaimDto) {
    const claim = await this.get(actor, id);
    if (claim.status !== 'OPEN') {
      throw new ConflictException(`Claim is ${claim.status}; only OPEN claims can be decided`);
    }
    const updated = await this.prisma.client.warrantyClaim.update({
      where: { id },
      data: {
        status: dto.approve ? 'APPROVED' : 'REJECTED',
        decidedAt: new Date(),
        decidedBy: actor.userId,
        decisionNotes: dto.notes?.trim() || null,
        updatedBy: actor.userId,
      },
      include: CLAIM_INCLUDE,
    });
    this.events.publish(RepairEventName.WarrantyClaimDecided, {
      tenantId: actor.tenantId,
      claimId: id,
      number: claim.number,
      approved: dto.approve,
      customerId: claim.customerId,
    });
    return updated;
  }

  /** Create the zero-charge revisit booking for an approved REPAIR_REVISIT claim. */
  async scheduleRevisit(actor: AuthPrincipal, id: string, dto: ScheduleRevisitDto) {
    const claim = await this.get(actor, id);
    if (claim.type !== 'REPAIR_REVISIT') {
      throw new BadRequestException('Only REPAIR_REVISIT claims get a revisit booking');
    }
    if (claim.status !== 'APPROVED') {
      throw new ConflictException('Claim must be APPROVED before scheduling a revisit');
    }
    if (claim.revisitBookingId) {
      throw new ConflictException({
        message: 'Revisit already scheduled',
        code: 'REVISIT_EXISTS',
        bookingId: claim.revisitBookingId,
      });
    }
    if (!claim.originalBookingId) {
      throw new BadRequestException('Claim has no original booking');
    }
    const original = await this.prisma.client.booking.findFirst({
      where: { id: claim.originalBookingId, tenantId: actor.tenantId },
    });
    if (!original) throw new NotFoundException('Original booking not found');

    const address = (original.addressSnapshot ?? {}) as unknown as CreateBookingDto['address'];
    const bookingDto: CreateBookingDto = {
      customerId: original.customerId,
      cityId: original.cityId,
      category: original.category,
      serviceType: original.serviceType ?? undefined,
      applianceBrand: original.applianceBrand ?? undefined,
      applianceType: original.applianceType ?? undefined,
      issueDescription: `Warranty revisit (${claim.number}) for ${original.code}: ${claim.reason}`.slice(
        0,
        2000,
      ),
      scheduledAt: dto.scheduledAt,
      scheduledTimeSlot: dto.scheduledTimeSlot,
      priority: 'PRIORITY',
      estimatedAmountMinor: 0,
      address: {
        line1: address?.line1 ?? '—',
        line2: address?.line2,
        landmark: address?.landmark,
        city: address?.city ?? '',
        state: address?.state ?? '',
        pincode: address?.pincode ?? '000000',
        country: address?.country,
      },
      addressId: original.addressId,
      geoLatitude: original.geoLatitude ?? undefined,
      geoLongitude: original.geoLongitude ?? undefined,
      notes: dto.notes,
      applianceId: claim.applianceId ?? original.applianceId ?? undefined,
      catalogItemId: original.catalogItemId ?? undefined,
      serviceMode: original.serviceMode,
    };

    const booking = await this.bookings.create(actor, bookingDto, {
      parentBookingId: original.id,
      isWarrantyRevisit: true,
    });
    if (!booking) throw new BadRequestException('Failed to create revisit booking');

    const updated = await this.prisma.client.warrantyClaim.update({
      where: { id },
      data: { revisitBookingId: booking.id, updatedBy: actor.userId },
      include: CLAIM_INCLUDE,
    });
    this.events.publish(RepairEventName.WarrantyRevisitScheduled, {
      tenantId: actor.tenantId,
      claimId: id,
      number: claim.number,
      revisitBookingId: booking.id,
      customerId: claim.customerId,
    });
    return updated;
  }

  async updateOem(actor: AuthPrincipal, id: string, dto: UpdateOemClaimDto) {
    const claim = await this.get(actor, id);
    if (claim.type !== 'OEM_CLAIM') {
      throw new BadRequestException('Only OEM_CLAIM claims can be submitted to the OEM');
    }
    if (dto.status === 'SUBMITTED_TO_OEM') {
      if (claim.status !== 'APPROVED') {
        throw new ConflictException('Claim must be APPROVED before submitting to the OEM');
      }
      if (!dto.oemClaimRef && !claim.oemClaimRef) {
        throw new BadRequestException('oemClaimRef is required when submitting to the OEM');
      }
    } else {
      if (claim.status !== 'SUBMITTED_TO_OEM') {
        throw new ConflictException('Claim must be SUBMITTED_TO_OEM before it can be settled');
      }
      if (dto.settledAmountMinor == null) {
        throw new BadRequestException('settledAmountMinor is required when settling');
      }
    }
    const updated = await this.prisma.client.warrantyClaim.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.oemClaimRef ? { oemClaimRef: dto.oemClaimRef.trim() } : {}),
        ...(dto.settledAmountMinor != null ? { settledAmountMinor: dto.settledAmountMinor } : {}),
        updatedBy: actor.userId,
      },
      include: CLAIM_INCLUDE,
    });
    this.events.publish(RepairEventName.WarrantyClaimOemUpdated, {
      tenantId: actor.tenantId,
      claimId: id,
      number: claim.number,
      status: dto.status,
    });
    return updated;
  }
}

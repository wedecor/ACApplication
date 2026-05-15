/**
 * Technician payout + commission engine.
 *
 * Lifecycle
 *  • Every `booking.status_changed → COMPLETED` event accrues a
 *    `TechnicianCommission` row by applying the technician's
 *    `TechnicianCommissionRule` to the booking's `finalAmountMinor`.
 *  • Admin can adjust (`adjustCommission`) or void (`reverseCommission`)
 *    individual accruals before they roll into a payout.
 *  • A scheduled / on-demand `closeCycle()` aggregates ACCRUED + ADJUSTED
 *    commissions for a period into a `TechnicianPayout` with status PENDING.
 *  • Approval → PROCESSING → PAID is a manual workflow with audit-logged
 *    transitions.
 */

import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  BookingStatus,
  CommissionStatus,
  CommissionType,
  DomainEventName,
  PayoutCycle,
  PayoutStatus,
} from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { PrismaService } from '../../common/prisma/prisma.service';
import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import { applyBps, ensureInteger } from '../../common/finance';
import type {
  AdjustCommissionDto,
  ApprovePayoutDto,
  CreatePayoutDto,
  MarkPayoutPaidDto,
  UpsertCommissionRuleDto,
} from './dto/payouts.dto';

interface RuleSnapshot {
  type: CommissionType;
  valueMinor: number;
  bonusMinor: number;
  penaltyPerLateMinuteMinor: number;
}

const DEFAULT_RULE: RuleSnapshot = {
  type: CommissionType.PERCENTAGE,
  valueMinor: 4000, // 40%
  bonusMinor: 0,
  penaltyPerLateMinuteMinor: 0,
};

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventBus,
  ) {}

  // -------------------------------------------------------------- rules
  async upsertRule(
    actor: AuthPrincipal,
    technicianId: string,
    dto: UpsertCommissionRuleDto,
  ) {
    const tech = await this.prisma.client.technician.findFirst({
      where: { id: technicianId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!tech) throw new NotFoundException('Technician not found');
    return this.prisma.client.technicianCommissionRule.upsert({
      where: { technicianId },
      update: { ...dto },
      create: {
        tenantId: actor.tenantId,
        technicianId,
        type: dto.type,
        valueMinor: dto.valueMinor,
        bonusMinor: dto.bonusMinor ?? 0,
        penaltyPerLateMinuteMinor: dto.penaltyPerLateMinuteMinor ?? 0,
        minPayoutMinor: dto.minPayoutMinor ?? 0,
        payoutCycle: dto.payoutCycle ?? PayoutCycle.WEEKLY,
      },
    });
  }

  // ----------------------------------------------------- commission accrual
  /**
   * Called from the BookingCompleted listener. Idempotent — duplicate
   * COMPLETED events do not double-accrue.
   */
  async accrueForBooking(bookingId: string): Promise<void> {
    const booking = await this.prisma.client.booking.findUnique({
      where: { id: bookingId },
      include: { commission: { select: { id: true } } },
    });
    if (!booking || booking.status !== BookingStatus.COMPLETED || !booking.technicianId) {
      return;
    }
    if (booking.commission) return; // already accrued

    const rule = (await this.prisma.client.technicianCommissionRule.findUnique({
      where: { technicianId: booking.technicianId },
    })) ?? null;
    const snapshot: RuleSnapshot = rule
      ? {
          type: rule.type as CommissionType,
          valueMinor: rule.valueMinor,
          bonusMinor: rule.bonusMinor,
          penaltyPerLateMinuteMinor: rule.penaltyPerLateMinuteMinor,
        }
      : DEFAULT_RULE;

    const final = booking.finalAmountMinor ?? booking.estimatedAmountMinor ?? 0;
    const base = this.computeBaseCommission(snapshot, final);
    const net = base + snapshot.bonusMinor;

    await this.prisma.client.technicianCommission.create({
      data: {
        tenantId: booking.tenantId,
        technicianId: booking.technicianId,
        bookingId: booking.id,
        baseMinor: base,
        bonusMinor: snapshot.bonusMinor,
        penaltyMinor: 0,
        adjustmentMinor: 0,
        netMinor: net,
        status: CommissionStatus.ACCRUED,
        ruleSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });
    this.logger.log(
      `Accrued ${net} (paise) commission for technician ${booking.technicianId} on booking ${booking.id}`,
    );
  }

  private computeBaseCommission(rule: RuleSnapshot, bookingTotalMinor: number): number {
    ensureInteger(bookingTotalMinor);
    if (rule.type === CommissionType.FLAT) return rule.valueMinor;
    if (rule.type === CommissionType.PER_JOB) return rule.valueMinor;
    return applyBps(bookingTotalMinor, rule.valueMinor); // PERCENTAGE
  }

  async adjustCommission(
    actor: AuthPrincipal,
    commissionId: string,
    dto: AdjustCommissionDto,
  ) {
    const row = await this.prisma.client.technicianCommission.findFirst({
      where: { id: commissionId, tenantId: actor.tenantId },
    });
    if (!row) throw new NotFoundException('Commission not found');
    if (row.status === CommissionStatus.PAID) {
      throw new ConflictException('Cannot adjust a paid commission');
    }
    const newAdjustment = row.adjustmentMinor + dto.adjustmentMinor;
    const net = row.baseMinor + row.bonusMinor - row.penaltyMinor + newAdjustment;
    return this.prisma.client.technicianCommission.update({
      where: { id: commissionId },
      data: {
        adjustmentMinor: newAdjustment,
        netMinor: net,
        status: CommissionStatus.ADJUSTED,
        notes: dto.notes
          ? [row.notes, `[adj by ${actor.userId}] ${dto.notes}`].filter(Boolean).join('\n')
          : row.notes,
      },
    });
  }

  async reverseCommission(actor: AuthPrincipal, commissionId: string) {
    const row = await this.prisma.client.technicianCommission.findFirst({
      where: { id: commissionId, tenantId: actor.tenantId },
    });
    if (!row) throw new NotFoundException('Commission not found');
    if (row.status === CommissionStatus.PAID) {
      throw new ConflictException('Cannot reverse a paid commission');
    }
    return this.prisma.client.technicianCommission.update({
      where: { id: commissionId },
      data: { status: CommissionStatus.REVERSED, netMinor: 0 },
    });
  }

  // ----------------------------------------------------------------- payouts
  async createPayout(actor: AuthPrincipal, dto: CreatePayoutDto) {
    const { periodStart, periodEnd } = this.resolvePeriod(dto);
    const tech = await this.prisma.client.technician.findFirst({
      where: { id: dto.technicianId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!tech) throw new NotFoundException('Technician not found');

    const accruals = await this.prisma.client.technicianCommission.findMany({
      where: {
        tenantId: actor.tenantId,
        technicianId: dto.technicianId,
        status: { in: [CommissionStatus.ACCRUED, CommissionStatus.ADJUSTED] },
        payoutId: null,
        createdAt: { gte: periodStart, lt: periodEnd },
      },
    });
    if (accruals.length === 0) {
      throw new BadRequestException('No unsettled commissions in that period');
    }
    const totals = accruals.reduce(
      (acc, row) => ({
        jobs: acc.jobs + 1,
        gross: acc.gross + row.baseMinor,
        bonus: acc.bonus + row.bonusMinor,
        penalty: acc.penalty + row.penaltyMinor,
        adjustment: acc.adjustment + row.adjustmentMinor,
        net: acc.net + row.netMinor,
      }),
      { jobs: 0, gross: 0, bonus: 0, penalty: 0, adjustment: 0, net: 0 },
    );

    const code = `PAY-${periodStart.toISOString().slice(0, 7)}-${randomUUID().slice(0, 6)}`.toUpperCase();
    return this.prisma.client.$transaction(async (tx) => {
      const payout = await tx.technicianPayout.create({
        data: {
          tenantId: actor.tenantId,
          technicianId: dto.technicianId,
          code,
          periodStart,
          periodEnd,
          jobsCount: totals.jobs,
          grossMinor: totals.gross,
          bonusMinor: totals.bonus,
          penaltyMinor: totals.penalty,
          adjustmentMinor: totals.adjustment,
          netMinor: totals.net,
          status: PayoutStatus.PENDING,
          notes: dto.notes ?? null,
        },
      });
      await tx.technicianCommission.updateMany({
        where: { id: { in: accruals.map((a) => a.id) } },
        data: { payoutId: payout.id },
      });
      this.events.publish(DomainEventName.PayoutCreated, {
        payoutId: payout.id,
        technicianId: payout.technicianId,
        netMinor: payout.netMinor,
      } as never);
      return payout;
    });
  }

  async approve(actor: AuthPrincipal, id: string, dto: ApprovePayoutDto) {
    const payout = await this.prisma.client.technicianPayout.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status !== PayoutStatus.PENDING) {
      throw new ConflictException(`Payout is ${payout.status}; only PENDING can be approved`);
    }
    const updated = await this.prisma.client.technicianPayout.update({
      where: { id },
      data: {
        status: PayoutStatus.APPROVED,
        approvedBy: actor.userId,
        approvedAt: new Date(),
        notes: dto.notes
          ? [payout.notes, `[approved by ${actor.userId}] ${dto.notes}`]
              .filter(Boolean)
              .join('\n')
          : payout.notes,
      },
    });
    this.events.publish(DomainEventName.PayoutApproved, {
      payoutId: id,
      approvedBy: actor.userId,
    } as never);
    return updated;
  }

  async markPaid(actor: AuthPrincipal, id: string, dto: MarkPayoutPaidDto) {
    const payout = await this.prisma.client.technicianPayout.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!payout) throw new NotFoundException('Payout not found');
    const allowedStatuses: ReadonlyArray<PayoutStatus> = [PayoutStatus.APPROVED, PayoutStatus.PROCESSING];
    if (!allowedStatuses.includes(payout.status as PayoutStatus)) {
      throw new ConflictException('Only APPROVED / PROCESSING payouts can be paid');
    }
    return this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.technicianPayout.update({
        where: { id },
        data: {
          status: PayoutStatus.PAID,
          paymentRef: dto.paymentRef ?? null,
          paidAt: new Date(),
        },
      });
      await tx.technicianCommission.updateMany({
        where: { payoutId: id },
        data: { status: CommissionStatus.PAID },
      });
      this.events.publish(DomainEventName.PayoutPaid, {
        payoutId: id,
        netMinor: updated.netMinor,
      } as never);
      return updated;
    });
  }

  async fail(_actor: AuthPrincipal, id: string, reason: string) {
    const updated = await this.prisma.client.technicianPayout.update({
      where: { id },
      data: { status: PayoutStatus.FAILED, failureReason: reason },
    });
    this.events.publish(DomainEventName.PayoutFailed, {
      payoutId: id,
      reason,
    } as never);
    return updated;
  }

  // ------------------------------------------------------------------- list
  async listPayouts(
    actor: AuthPrincipal,
    filter: { status?: PayoutStatus; technicianId?: string },
  ) {
    return this.prisma.client.technicianPayout.findMany({
      where: { tenantId: actor.tenantId, status: filter.status, technicianId: filter.technicianId },
      orderBy: { createdAt: 'desc' },
      include: {
        technician: {
          select: { id: true, user: { select: { firstName: true, lastName: true } } },
        },
      },
      take: 200,
    });
  }

  async getPayout(actor: AuthPrincipal, id: string) {
    const payout = await this.prisma.client.technicianPayout.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        commissions: { include: { booking: { select: { id: true, finalAmountMinor: true } } } },
        technician: {
          select: { id: true, user: { select: { firstName: true, lastName: true, email: true } } },
        },
      },
    });
    if (!payout) throw new NotFoundException('Payout not found');
    return payout;
  }

  async pendingForTechnician(actor: AuthPrincipal, technicianId: string) {
    const accruals = await this.prisma.client.technicianCommission.aggregate({
      where: {
        tenantId: actor.tenantId,
        technicianId,
        status: { in: [CommissionStatus.ACCRUED, CommissionStatus.ADJUSTED] },
        payoutId: null,
      },
      _sum: { netMinor: true },
      _count: true,
    });
    return {
      pendingNetMinor: accruals._sum.netMinor ?? 0,
      pendingJobs: accruals._count,
    };
  }

  // ----------------------------------------------------------- date helpers
  private resolvePeriod(dto: CreatePayoutDto): { periodStart: Date; periodEnd: Date } {
    if (dto.periodStart && dto.periodEnd) {
      return { periodStart: new Date(dto.periodStart), periodEnd: new Date(dto.periodEnd) };
    }
    // Default: last completed Mon-Sun week
    const now = new Date();
    const day = now.getUTCDay();
    const thisMonday = new Date(now);
    thisMonday.setUTCHours(0, 0, 0, 0);
    thisMonday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
    const lastMonday = new Date(thisMonday);
    lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);
    return { periodStart: lastMonday, periodEnd: thisMonday };
  }
}

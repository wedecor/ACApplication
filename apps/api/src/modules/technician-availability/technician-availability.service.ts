import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  canTransitionTechnicianStatus,
  DISPATCHABLE_TECHNICIAN_STATUSES,
  DomainEventName,
  type TechnicianId,
  TechnicianStatus,
} from '@ac/types';
import type { Prisma } from '@ac/database';

import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TrackingService } from '../tracking/tracking.service';

/**
 * Owns the technician state machine + daily aggregates + shift records.
 *
 * Status transitions are enforced via `canTransitionTechnicianStatus`. Each
 * transition can have side-effects:
 *   - OFFLINE → ONLINE  : open a TechnicianShift, record onlineSince.
 *   - ONLINE  → OFFLINE : close shift, clear last position from Redis.
 *   - * → UNREACHABLE   : raise a DispatchEvent (handled by SLA monitor).
 */
const OFFLINE_TIMEOUT_MS = 3 * 60 * 1000;

@Injectable()
export class TechnicianAvailabilityService {
  private readonly logger = new Logger(TechnicianAvailabilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly _tracking: TrackingService,
    private readonly events: DomainEventBus,
  ) {
    void this._tracking;
  }

  /** Called from `POST /technicians/:id/status`. */
  async setStatus(
    actorUserId: string,
    technicianId: string,
    next: TechnicianStatus,
    _reason?: string,
  ) {
    const tech = await this.prisma.client.technician.findFirst({
      where: { id: technicianId, deletedAt: null },
      select: {
        id: true,
        tenantId: true,
        cityId: true,
        userId: true,
        status: true,
        onlineSince: true,
      },
    });
    if (!tech) throw new NotFoundException('Technician not found');
    if (tech.userId !== actorUserId) {
      throw new ForbiddenException('Cannot change status for another technician');
    }
    if (tech.status === next) return tech;
    if (!canTransitionTechnicianStatus(tech.status as TechnicianStatus, next)) {
      throw new BadRequestException(
        `Cannot transition technician from ${tech.status} to ${next}`,
      );
    }

    const now = new Date();
    const update: Prisma.TechnicianUpdateInput = { status: next, lastSeenAt: now };

    // Shift open / close. We never block the status change on the shift write.
    if (tech.status === TechnicianStatus.OFFLINE && next !== TechnicianStatus.OFFLINE) {
      update.onlineSince = now;
      await this.prisma.client.technicianShift
        .create({
          data: {
            tenantId: tech.tenantId,
            technicianId: tech.id,
            startedAt: now,
          },
        })
        .catch((err) => this.logger.warn({ err }, 'shift open failed'));

      this.events.publish(DomainEventName.TechnicianOnline, {
        technicianId: tech.id as TechnicianId,
        cityId: tech.cityId,
      });
    }

    if (next === TechnicianStatus.OFFLINE && tech.status !== TechnicianStatus.OFFLINE) {
      update.onlineSince = null;
      await this.closeOpenShift(tech.id, now, 'manual', tech.onlineSince);
      this.events.publish(DomainEventName.TechnicianOffline, {
        technicianId: tech.id as TechnicianId,
        cityId: tech.cityId,
        reason: 'manual',
      });
    }

    const updated = await this.prisma.client.technician.update({
      where: { id: tech.id },
      data: update,
    });

    this.events.publish(DomainEventName.TechnicianStatusChanged, {
      technicianId: tech.id as TechnicianId,
      status: next,
    });

    return updated;
  }

  /** Snapshot for dispatcher "availability" panel. */
  async availabilityOverview(tenantId: string, cityId?: string) {
    const techs = await this.prisma.client.technician.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(cityId ? { cityId } : {}),
      },
      select: {
        id: true,
        fullName: true,
        cityId: true,
        status: true,
        rating: true,
        acceptanceRate: true,
        completionRate: true,
        dailyCapacity: true,
        lastSeenAt: true,
        onlineSince: true,
        lastLocationAt: true,
        _count: {
          select: {
            bookings: {
              where: {
                status: { in: ['ASSIGNED', 'TECHNICIAN_EN_ROUTE', 'IN_PROGRESS', 'WAITING_PARTS'] },
                deletedAt: null,
              },
            },
          },
        },
      },
    });

    const buckets = {
      available: 0,
      engaged: 0,
      onBreak: 0,
      offline: 0,
      unreachable: 0,
    };
    for (const t of techs) {
      if (DISPATCHABLE_TECHNICIAN_STATUSES.has(t.status as TechnicianStatus)) buckets.available += 1;
      else if (t.status === TechnicianStatus.ON_BREAK) buckets.onBreak += 1;
      else if (t.status === TechnicianStatus.UNREACHABLE) buckets.unreachable += 1;
      else if (t.status === TechnicianStatus.OFFLINE) buckets.offline += 1;
      else buckets.engaged += 1;
    }
    return { buckets, technicians: techs };
  }

  /**
   * SLA monitor hook — flips technicians whose `lastSeenAt` is older than
   * OFFLINE_TIMEOUT_MS to UNREACHABLE (and to OFFLINE after a longer window).
   */
  async sweepStaleTechnicians(): Promise<{ flippedUnreachable: number; closedShifts: number }> {
    const cutoff = new Date(Date.now() - OFFLINE_TIMEOUT_MS);

    const stale = await this.prisma.client.technician.findMany({
      where: {
        deletedAt: null,
        status: { in: ['ONLINE', 'AVAILABLE', 'EN_ROUTE', 'WORKING'] },
        OR: [{ lastSeenAt: { lt: cutoff } }, { lastSeenAt: null, onlineSince: { lt: cutoff } }],
      },
      select: { id: true, tenantId: true, cityId: true, status: true, lastSeenAt: true, onlineSince: true },
    });
    if (stale.length === 0) return { flippedUnreachable: 0, closedShifts: 0 };

    let closedShifts = 0;
    for (const t of stale) {
      await this.prisma.client.technician.update({
        where: { id: t.id },
        data: { status: TechnicianStatus.UNREACHABLE },
      });
      this.events.publish(DomainEventName.TechnicianUnreachable, {
        technicianId: t.id as TechnicianId,
        lastSeenAt: t.lastSeenAt?.toISOString() ?? t.onlineSince?.toISOString() ?? new Date().toISOString(),
      });
    }

    // Auto-close shifts whose last ping is > 30 min old.
    const hardCutoff = new Date(Date.now() - 30 * 60_000);
    const veryStale = await this.prisma.client.technician.findMany({
      where: {
        deletedAt: null,
        status: TechnicianStatus.UNREACHABLE,
        lastSeenAt: { lt: hardCutoff },
        onlineSince: { not: null },
      },
      select: { id: true, tenantId: true, cityId: true, lastSeenAt: true, onlineSince: true },
    });
    for (const t of veryStale) {
      await this.closeOpenShift(t.id, t.lastSeenAt ?? new Date(), 'auto_offline_timeout', t.onlineSince);
      await this.prisma.client.technician.update({
        where: { id: t.id },
        data: { status: TechnicianStatus.OFFLINE, onlineSince: null },
      });
      this.events.publish(DomainEventName.TechnicianOffline, {
        technicianId: t.id as TechnicianId,
        cityId: t.cityId,
        reason: 'timeout',
      });
      closedShifts += 1;
    }

    return { flippedUnreachable: stale.length, closedShifts };
  }

  private async closeOpenShift(
    technicianId: string,
    endedAt: Date,
    reason: string,
    onlineSince: Date | null,
  ): Promise<void> {
    const open = await this.prisma.client.technicianShift.findFirst({
      where: { technicianId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (!open) return;
    const startedAt = onlineSince ?? open.startedAt;
    const durationMin = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000));
    await this.prisma.client.technicianShift.update({
      where: { id: open.id },
      data: { endedAt, durationMin, endReason: reason },
    });
  }
}

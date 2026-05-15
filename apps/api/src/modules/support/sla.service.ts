import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  OPEN_TICKET_STATUSES,
  SlaTargetKind,
  type TicketStatus,
} from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { PrismaService } from '../../common/prisma/prisma.service';
import { warningWindowMinutes } from '../../common/support/sla';
import type { SlaProfileDto } from './dto/sla.dto';
import { TicketsService } from './tickets.service';

/**
 * Owns the SLA profile CRUD surface AND the breach/warning scanner that
 * the scheduler invokes every minute. Keeping them in one service avoids
 * a circular import between the scheduler and tickets service.
 */
@Injectable()
export class SlaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tickets: TicketsService,
  ) {}

  // -------------------------------------------------------------- profiles

  async createProfile(actor: AuthPrincipal, dto: SlaProfileDto): Promise<{ id: string }> {
    if (dto.isDefault) {
      await this.prisma.client.sLAProfile.updateMany({
        where: { tenantId: actor.tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }
    const row = await this.prisma.client.sLAProfile.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name,
        description: dto.description,
        firstResponseMinutes: dto.firstResponseMinutes,
        resolutionMinutes: dto.resolutionMinutes,
        businessHoursOnly: dto.businessHoursOnly ?? false,
        priorityOverrides: (dto.priorityOverrides ?? {}) as Prisma.InputJsonValue,
        isDefault: dto.isDefault ?? false,
        isActive: dto.isActive ?? true,
      },
      select: { id: true },
    });
    return row;
  }

  async updateProfile(actor: AuthPrincipal, id: string, dto: SlaProfileDto): Promise<void> {
    const profile = await this.prisma.client.sLAProfile.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('SLA profile not found');
    if (dto.isDefault) {
      await this.prisma.client.sLAProfile.updateMany({
        where: { tenantId: actor.tenantId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }
    await this.prisma.client.sLAProfile.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        firstResponseMinutes: dto.firstResponseMinutes,
        resolutionMinutes: dto.resolutionMinutes,
        businessHoursOnly: dto.businessHoursOnly ?? false,
        priorityOverrides: (dto.priorityOverrides ?? {}) as Prisma.InputJsonValue,
        isDefault: dto.isDefault ?? false,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async listProfiles(actor: AuthPrincipal): Promise<unknown[]> {
    return this.prisma.client.sLAProfile.findMany({
      where: { tenantId: actor.tenantId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async deleteProfile(actor: AuthPrincipal, id: string): Promise<void> {
    await this.prisma.client.sLAProfile.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    void actor;
  }

  // ----------------------------------------------------------- scanner

  /**
   * Single-tick of the breach scanner. Idempotent — uses the activity table
   * + the ticket's own timestamps to avoid emitting the same warning twice.
   *
   * 1. For each open ticket with `firstResponseDueAt` in the warning window
   *    AND no `firstResponseAt`, emit a warning event.
   * 2. For each open ticket with `firstResponseDueAt < now` AND no
   *    `firstResponseAt`, emit a breach + auto-escalate.
   * 3. Same dance for `resolutionDueAt` / `resolvedAt`.
   */
  async scanTenant(tenantId: string): Promise<{ warnings: number; breaches: number }> {
    const now = new Date();
    const openStatuses = Array.from(OPEN_TICKET_STATUSES) as TicketStatus[];
    const tickets = await this.prisma.client.supportTicket.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: openStatuses },
        OR: [
          { firstResponseDueAt: { not: null } },
          { resolutionDueAt: { not: null } },
        ],
      },
      select: {
        id: true,
        status: true,
        priority: true,
        firstResponseRecorded: true,
        firstResponseDueAt: true,
        firstResponseAt: true,
        resolutionDueAt: true,
        resolvedAt: true,
        slaProfile: {
          select: {
            firstResponseMinutes: true,
            resolutionMinutes: true,
          },
        },
      },
      take: 1000,
    });
    let warnings = 0;
    let breaches = 0;

    for (const t of tickets) {
      // First response.
      if (!t.firstResponseRecorded && t.firstResponseDueAt) {
        const minutesRemaining = Math.round(
          (t.firstResponseDueAt.getTime() - now.getTime()) / 60_000,
        );
        const window = warningWindowMinutes(t.slaProfile?.firstResponseMinutes ?? 30);
        if (minutesRemaining <= 0) {
          if (!(await this.hasBreachActivity(tenantId, t.id, SlaTargetKind.FIRST_RESPONSE))) {
            await this.tickets.recordSlaBreach(
              tenantId,
              t.id,
              SlaTargetKind.FIRST_RESPONSE,
              t.firstResponseDueAt,
              Math.abs(minutesRemaining),
            );
            await this.tickets.autoEscalateOnBreach(
              tenantId,
              t.id,
              `First-response SLA breached by ${Math.abs(minutesRemaining)}m`,
            );
            breaches += 1;
          }
        } else if (minutesRemaining <= window) {
          if (!(await this.hasWarningActivity(tenantId, t.id, SlaTargetKind.FIRST_RESPONSE))) {
            await this.tickets.recordSlaWarning(
              tenantId,
              t.id,
              SlaTargetKind.FIRST_RESPONSE,
              t.firstResponseDueAt,
              minutesRemaining,
            );
            warnings += 1;
          }
        }
      }

      // Resolution.
      if (!t.resolvedAt && t.resolutionDueAt) {
        const minutesRemaining = Math.round(
          (t.resolutionDueAt.getTime() - now.getTime()) / 60_000,
        );
        const window = warningWindowMinutes(t.slaProfile?.resolutionMinutes ?? 480);
        if (minutesRemaining <= 0) {
          if (!(await this.hasBreachActivity(tenantId, t.id, SlaTargetKind.RESOLUTION))) {
            await this.tickets.recordSlaBreach(
              tenantId,
              t.id,
              SlaTargetKind.RESOLUTION,
              t.resolutionDueAt,
              Math.abs(minutesRemaining),
            );
            await this.tickets.autoEscalateOnBreach(
              tenantId,
              t.id,
              `Resolution SLA breached by ${Math.abs(minutesRemaining)}m`,
            );
            breaches += 1;
          }
        } else if (minutesRemaining <= window) {
          if (!(await this.hasWarningActivity(tenantId, t.id, SlaTargetKind.RESOLUTION))) {
            await this.tickets.recordSlaWarning(
              tenantId,
              t.id,
              SlaTargetKind.RESOLUTION,
              t.resolutionDueAt,
              minutesRemaining,
            );
            warnings += 1;
          }
        }
      }
    }
    return { warnings, breaches };
  }

  private async hasWarningActivity(
    tenantId: string,
    ticketId: string,
    target: SlaTargetKind,
  ): Promise<boolean> {
    const row = await this.prisma.client.ticketActivity.findFirst({
      where: {
        tenantId,
        ticketId,
        type: 'SLA_BREACH_WARNING',
        metadata: { path: ['target'], equals: target },
      },
      select: { id: true },
    });
    return !!row;
  }

  private async hasBreachActivity(
    tenantId: string,
    ticketId: string,
    target: SlaTargetKind,
  ): Promise<boolean> {
    const row = await this.prisma.client.ticketActivity.findFirst({
      where: {
        tenantId,
        ticketId,
        type: 'SLA_BREACHED',
        metadata: { path: ['target'], equals: target },
      },
      select: { id: true },
    });
    return !!row;
  }
}

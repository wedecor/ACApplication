import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  CallStatus,
  ConversationChannel,
  MISSED_CALL_STATUSES,
  TicketPriority,
  TicketStatus,
} from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { PrismaService } from '../../common/prisma/prisma.service';

export interface SupportRange {
  from?: string;
  to?: string;
}

interface DateRange {
  gte: Date;
  lte: Date;
}

/**
 * Read-only analytics surface for the /dashboard/support, /csat,
 * /call-center pages. All metrics are computed with simple aggregate
 * queries — keep them cheap.
 */
@Injectable()
export class SupportAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(actor: AuthPrincipal, range: SupportRange) {
    const dr = this.resolveRange(range);
    const where: Prisma.SupportTicketWhereInput = {
      tenantId: actor.tenantId,
      deletedAt: null,
      createdAt: dr,
    };
    const [totalCreated, openTickets, resolved, byPriority, byStatus, bySource, slaStats, csatStats] = await Promise.all([
      this.prisma.client.supportTicket.count({ where }),
      this.prisma.client.supportTicket.count({
        where: {
          tenantId: actor.tenantId,
          deletedAt: null,
          status: {
            in: [
              TicketStatus.OPEN,
              TicketStatus.PENDING,
              TicketStatus.WAITING_CUSTOMER,
              TicketStatus.ON_HOLD,
              TicketStatus.ESCALATED,
            ],
          },
        },
      }),
      this.prisma.client.supportTicket.count({
        where: { ...where, status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] } },
      }),
      this.prisma.client.supportTicket.groupBy({
        by: ['priority'],
        where,
        _count: { _all: true },
      }),
      this.prisma.client.supportTicket.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.client.supportTicket.groupBy({
        by: ['source'],
        where,
        _count: { _all: true },
      }),
      this.computeSlaCompliance(actor.tenantId, dr),
      this.computeCsat(actor.tenantId, dr),
    ]);

    return {
      range: { from: dr.gte.toISOString(), to: dr.lte.toISOString() },
      totals: {
        created: totalCreated,
        open: openTickets,
        resolved,
        resolutionRate: totalCreated > 0 ? Math.round((resolved / totalCreated) * 10000) / 100 : 0,
      },
      byPriority: priorityRollup(byPriority),
      byStatus: statusRollup(byStatus),
      bySource: bySource.map((r) => ({ source: r.source, count: r._count._all })),
      sla: slaStats,
      csat: csatStats,
    };
  }

  async responseTimes(actor: AuthPrincipal, range: SupportRange) {
    const dr = this.resolveRange(range);
    // Use raw SQL for percentiles — Prisma doesn't support PERCENTILE_DISC.
    const rows = await this.prisma.client.$queryRaw<
      Array<{
        avg_first_seconds: number | null;
        p50_first_seconds: number | null;
        p90_first_seconds: number | null;
        avg_resolution_seconds: number | null;
        p50_resolution_seconds: number | null;
        p90_resolution_seconds: number | null;
      }>
    >`
      SELECT
        AVG(EXTRACT(EPOCH FROM ("firstResponseAt" - "createdAt")))      AS avg_first_seconds,
        PERCENTILE_DISC(0.5)  WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("firstResponseAt" - "createdAt"))) AS p50_first_seconds,
        PERCENTILE_DISC(0.9)  WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("firstResponseAt" - "createdAt"))) AS p90_first_seconds,
        AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")))           AS avg_resolution_seconds,
        PERCENTILE_DISC(0.5)  WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt"))) AS p50_resolution_seconds,
        PERCENTILE_DISC(0.9)  WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt"))) AS p90_resolution_seconds
      FROM support_tickets
      WHERE "tenantId" = ${actor.tenantId}
        AND "deletedAt" IS NULL
        AND "createdAt" BETWEEN ${dr.gte} AND ${dr.lte}
    `;
    const r = rows[0];
    return {
      firstResponseSeconds: {
        avg: Math.round(r?.avg_first_seconds ?? 0),
        p50: Math.round(r?.p50_first_seconds ?? 0),
        p90: Math.round(r?.p90_first_seconds ?? 0),
      },
      resolutionSeconds: {
        avg: Math.round(r?.avg_resolution_seconds ?? 0),
        p50: Math.round(r?.p50_resolution_seconds ?? 0),
        p90: Math.round(r?.p90_resolution_seconds ?? 0),
      },
    };
  }

  async agentProductivity(actor: AuthPrincipal, range: SupportRange) {
    const dr = this.resolveRange(range);
    const rows = await this.prisma.client.$queryRaw<
      Array<{
        agentid: string;
        first_name: string | null;
        last_name: string | null;
        handled: number;
        resolved: number;
        avg_resolution_seconds: number | null;
      }>
    >`
      SELECT
        u.id AS agentId,
        u."firstName" AS first_name,
        u."lastName"  AS last_name,
        COUNT(t.id)::int AS handled,
        SUM(CASE WHEN t.status IN ('RESOLVED', 'CLOSED') THEN 1 ELSE 0 END)::int AS resolved,
        AVG(EXTRACT(EPOCH FROM (t."resolvedAt" - t."createdAt"))) AS avg_resolution_seconds
      FROM support_tickets t
      JOIN users u ON u.id = t."assignedAgentId"
      WHERE t."tenantId" = ${actor.tenantId}
        AND t."deletedAt" IS NULL
        AND t."createdAt" BETWEEN ${dr.gte} AND ${dr.lte}
      GROUP BY u.id, u."firstName", u."lastName"
      ORDER BY handled DESC
      LIMIT 50
    `;
    return rows.map((r) => ({
      agentId: r.agentid,
      name: [r.first_name, r.last_name].filter(Boolean).join(' '),
      handled: Number(r.handled),
      resolved: Number(r.resolved),
      avgResolutionSeconds: Math.round(r.avg_resolution_seconds ?? 0),
    }));
  }

  async channelBreakdown(actor: AuthPrincipal, range: SupportRange) {
    const dr = this.resolveRange(range);
    const rows = await this.prisma.client.conversation.groupBy({
      by: ['channel'],
      where: {
        tenantId: actor.tenantId,
        deletedAt: null,
        createdAt: dr,
      },
      _count: { _all: true },
    });
    const messages = await this.prisma.client.conversationMessage.groupBy({
      by: ['channel', 'direction'],
      where: {
        tenantId: actor.tenantId,
        deletedAt: null,
        createdAt: dr,
      },
      _count: { _all: true },
    });
    const channelMap: Record<string, { conversations: number; inbound: number; outbound: number }> = {};
    for (const c of Object.values(ConversationChannel)) {
      channelMap[c] = { conversations: 0, inbound: 0, outbound: 0 };
    }
    for (const r of rows) {
      const entry = channelMap[r.channel];
      if (entry) entry.conversations = r._count._all;
    }
    for (const r of messages) {
      const entry = channelMap[r.channel];
      if (!entry) continue;
      if (r.direction === 'INBOUND') entry.inbound = r._count._all;
      else entry.outbound = r._count._all;
    }
    return channelMap;
  }

  async callCenter(actor: AuthPrincipal, range: SupportRange) {
    const dr = this.resolveRange(range);
    const where: Prisma.CallLogWhereInput = {
      tenantId: actor.tenantId,
      deletedAt: null,
      startedAt: dr,
    };
    const [total, byStatus, byDisposition, avgDuration] = await Promise.all([
      this.prisma.client.callLog.count({ where }),
      this.prisma.client.callLog.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.client.callLog.groupBy({
        by: ['disposition'],
        where: { ...where, disposition: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.client.callLog.aggregate({
        where: { ...where, status: CallStatus.COMPLETED },
        _avg: { durationS: true },
      }),
    ]);
    const missed = byStatus
      .filter((r) => MISSED_CALL_STATUSES.has(r.status as CallStatus))
      .reduce((sum, r) => sum + r._count._all, 0);
    return {
      total,
      missed,
      missedRate: total > 0 ? Math.round((missed / total) * 10000) / 100 : 0,
      avgDurationSeconds: Math.round(avgDuration._avg.durationS ?? 0),
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
      byDisposition: byDisposition.map((r) => ({
        disposition: r.disposition,
        count: r._count._all,
      })),
    };
  }

  // ----------------------------------------------------------- helpers

  private async computeSlaCompliance(
    tenantId: string,
    dr: DateRange,
  ): Promise<{ firstResponse: { met: number; missed: number; rate: number }; resolution: { met: number; missed: number; rate: number } }> {
    const tickets = await this.prisma.client.supportTicket.findMany({
      where: { tenantId, deletedAt: null, createdAt: dr },
      select: {
        firstResponseAt: true,
        firstResponseDueAt: true,
        resolvedAt: true,
        resolutionDueAt: true,
      },
    });
    let frMet = 0;
    let frMissed = 0;
    let resMet = 0;
    let resMissed = 0;
    for (const t of tickets) {
      if (t.firstResponseAt && t.firstResponseDueAt) {
        if (t.firstResponseAt <= t.firstResponseDueAt) frMet += 1;
        else frMissed += 1;
      }
      if (t.resolvedAt && t.resolutionDueAt) {
        if (t.resolvedAt <= t.resolutionDueAt) resMet += 1;
        else resMissed += 1;
      }
    }
    return {
      firstResponse: {
        met: frMet,
        missed: frMissed,
        rate: frMet + frMissed > 0 ? Math.round((frMet / (frMet + frMissed)) * 10000) / 100 : 0,
      },
      resolution: {
        met: resMet,
        missed: resMissed,
        rate:
          resMet + resMissed > 0 ? Math.round((resMet / (resMet + resMissed)) * 10000) / 100 : 0,
      },
    };
  }

  private async computeCsat(
    tenantId: string,
    dr: DateRange,
  ): Promise<{ count: number; averageRating: number; promoters: number; detractors: number }> {
    const ratings = await this.prisma.client.supportTicket.findMany({
      where: {
        tenantId,
        deletedAt: null,
        createdAt: dr,
        satisfactionRating: { not: null },
      },
      select: { satisfactionRating: true },
    });
    const count = ratings.length;
    if (count === 0) return { count: 0, averageRating: 0, promoters: 0, detractors: 0 };
    const sum = ratings.reduce((s, r) => s + (r.satisfactionRating ?? 0), 0);
    const promoters = ratings.filter((r) => (r.satisfactionRating ?? 0) >= 4).length;
    const detractors = ratings.filter((r) => (r.satisfactionRating ?? 0) <= 2).length;
    return {
      count,
      averageRating: Math.round((sum / count) * 100) / 100,
      promoters,
      detractors,
    };
  }

  private resolveRange(range: SupportRange): DateRange {
    const to = range.to ? new Date(range.to) : new Date();
    const from = range.from
      ? new Date(range.from)
      : new Date(to.getTime() - 30 * 86_400_000);
    return { gte: from, lte: to };
  }
}

function priorityRollup(
  rows: Array<{ priority: TicketPriority; _count: { _all: number } }>,
): Array<{ priority: TicketPriority; count: number }> {
  const map: Partial<Record<TicketPriority, number>> = {};
  for (const r of rows) map[r.priority] = r._count._all;
  return Object.values(TicketPriority).map((p) => ({ priority: p, count: map[p] ?? 0 }));
}

function statusRollup(
  rows: Array<{ status: TicketStatus; _count: { _all: number } }>,
): Array<{ status: TicketStatus; count: number }> {
  const map: Partial<Record<TicketStatus, number>> = {};
  for (const r of rows) map[r.status] = r._count._all;
  return Object.values(TicketStatus).map((s) => ({ status: s, count: map[s] ?? 0 }));
}

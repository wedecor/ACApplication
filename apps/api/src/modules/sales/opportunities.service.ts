import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthPrincipal } from '@ac/auth';
import { OpportunityStage, type Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  ChangeStageDto,
  CreateOpportunityDto,
  ListOpportunitiesDto,
  OpportunityFromLeadDto,
  UpdateOpportunityDto,
} from './dto/opportunity.dto';

export const STAGE_ORDER: OpportunityStage[] = [
  OpportunityStage.NEW,
  OpportunityStage.QUALIFIED,
  OpportunityStage.PROPOSAL,
  OpportunityStage.NEGOTIATION,
  OpportunityStage.WON,
  OpportunityStage.LOST,
];

export const DEFAULT_STAGE_PROBABILITY: Record<OpportunityStage, number> = {
  NEW: 10,
  QUALIFIED: 25,
  PROPOSAL: 50,
  NEGOTIATION: 75,
  WON: 100,
  LOST: 0,
};

const CLOSED_STAGES = new Set<OpportunityStage>([OpportunityStage.WON, OpportunityStage.LOST]);

export function isClosedStage(stage: OpportunityStage): boolean {
  return CLOSED_STAGES.has(stage);
}

export interface PipelineRow {
  stage: OpportunityStage;
  valueMinor: number;
  probabilityPct: number;
}

export interface PipelineSummary {
  stages: { stage: OpportunityStage; count: number; valueMinor: number; weightedMinor: number }[];
  openCount: number;
  openValueMinor: number;
  weightedForecastMinor: number;
  wonValueMinor: number;
  wonCount: number;
  lostCount: number;
  winRatePct: number;
}

/** Pure pipeline aggregation — weighted value = value × probability (rounded per row). */
export function summarisePipeline(rows: PipelineRow[]): PipelineSummary {
  const byStage = new Map(
    STAGE_ORDER.map((stage) => [stage, { stage, count: 0, valueMinor: 0, weightedMinor: 0 }]),
  );
  for (const row of rows) {
    const bucket = byStage.get(row.stage)!;
    bucket.count += 1;
    bucket.valueMinor += row.valueMinor;
    bucket.weightedMinor += Math.round((row.valueMinor * row.probabilityPct) / 100);
  }
  const stages = [...byStage.values()];
  const open = stages.filter((s) => !isClosedStage(s.stage));
  const won = byStage.get(OpportunityStage.WON)!;
  const lost = byStage.get(OpportunityStage.LOST)!;
  const closed = won.count + lost.count;
  return {
    stages,
    openCount: open.reduce((n, s) => n + s.count, 0),
    openValueMinor: open.reduce((n, s) => n + s.valueMinor, 0),
    weightedForecastMinor: open.reduce((n, s) => n + s.weightedMinor, 0),
    wonValueMinor: won.valueMinor,
    wonCount: won.count,
    lostCount: lost.count,
    winRatePct: closed === 0 ? 0 : Math.round((won.count / closed) * 100),
  };
}

export interface StageChange {
  stage?: OpportunityStage;
  probabilityPct?: number;
  closedAt?: Date | null;
  lostReason?: string | null;
}

/**
 * Compute the fields that change when an opportunity moves to `to`.
 * WON/LOST stamp `closedAt`; reopening clears it and the lost reason.
 */
export function stageTransition(
  current: { stage: OpportunityStage; closedAt: Date | null },
  to: OpportunityStage,
  lostReason: string | undefined,
  now: Date = new Date(),
): StageChange {
  if (to === OpportunityStage.LOST && !lostReason?.trim()) {
    throw new BadRequestException('lostReason is required when marking an opportunity LOST');
  }
  const data: StageChange = {
    stage: to,
    probabilityPct: DEFAULT_STAGE_PROBABILITY[to],
  };
  if (isClosedStage(to)) {
    data.closedAt = current.stage === to && current.closedAt ? current.closedAt : now;
    data.lostReason = to === OpportunityStage.LOST ? lostReason!.trim() : null;
  } else {
    data.closedAt = null;
    data.lostReason = null;
  }
  return data;
}

const OPPORTUNITY_INCLUDE = {
  account: { select: { id: true, name: true } },
  customer: { select: { id: true, fullName: true } },
  lead: { select: { id: true, code: true, customerName: true } },
} satisfies Prisma.OpportunityInclude;

@Injectable()
export class OpportunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AuthPrincipal, query: ListOpportunitiesDto) {
    const where: Prisma.OpportunityWhereInput = {
      tenantId: actor.tenantId,
      deletedAt: null,
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.ownerUserId ? { ownerUserId: query.ownerUserId } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { account: { name: { contains: query.search, mode: 'insensitive' } } },
              { customer: { fullName: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.opportunity.findMany({
        where,
        include: OPPORTUNITY_INCLUDE,
        orderBy: [{ expectedCloseAt: 'asc' }, { createdAt: 'desc' }],
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.client.opportunity.count({ where }),
    ]);
    return { items, total };
  }

  async pipeline(actor: AuthPrincipal, ownerUserId?: string): Promise<PipelineSummary> {
    const rows = await this.prisma.client.opportunity.findMany({
      where: {
        tenantId: actor.tenantId,
        deletedAt: null,
        ...(ownerUserId ? { ownerUserId } : {}),
      },
      select: { stage: true, valueMinor: true, probabilityPct: true },
    });
    return summarisePipeline(rows);
  }

  async get(actor: AuthPrincipal, id: string) {
    const row = await this.prisma.client.opportunity.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
      include: OPPORTUNITY_INCLUDE,
    });
    if (!row) throw new NotFoundException('Opportunity not found');
    return row;
  }

  async create(actor: AuthPrincipal, dto: CreateOpportunityDto) {
    await this.assertLinks(actor.tenantId, dto);
    const stage = dto.stage ?? OpportunityStage.NEW;
    return this.prisma.client.opportunity.create({
      data: {
        tenantId: actor.tenantId,
        title: dto.title.trim(),
        accountId: dto.accountId ?? null,
        customerId: dto.customerId ?? null,
        leadId: dto.leadId ?? null,
        stage,
        valueMinor: dto.valueMinor ?? 0,
        probabilityPct: dto.probabilityPct ?? DEFAULT_STAGE_PROBABILITY[stage],
        expectedCloseAt: dto.expectedCloseAt ? new Date(dto.expectedCloseAt) : null,
        ownerUserId: dto.ownerUserId ?? actor.userId,
        closedAt: isClosedStage(stage) ? new Date() : null,
        notes: dto.notes ?? null,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
      include: OPPORTUNITY_INCLUDE,
    });
  }

  async createFromLead(actor: AuthPrincipal, leadId: string, dto: OpportunityFromLeadDto) {
    const lead = await this.prisma.client.lead.findFirst({
      where: { id: leadId, tenantId: actor.tenantId, deletedAt: null },
      select: {
        id: true,
        customerName: true,
        applianceType: true,
        assignedUserId: true,
        phone: true,
        booking: { select: { customerId: true } },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    const existing = await this.prisma.client.opportunity.findFirst({
      where: {
        tenantId: actor.tenantId,
        leadId,
        deletedAt: null,
        stage: { notIn: [OpportunityStage.WON, OpportunityStage.LOST] },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`Lead already has open opportunity ${existing.id}`);
    }
    const customerId =
      lead.booking?.customerId ??
      (
        await this.prisma.client.customer.findFirst({
          where: { tenantId: actor.tenantId, phone: lead.phone, deletedAt: null, mergedIntoId: null },
          select: { id: true },
        })
      )?.id;

    return this.create(actor, {
      title:
        dto.title ??
        `${lead.customerName}${lead.applianceType ? ` — ${lead.applianceType}` : ''}`.slice(0, 200),
      leadId: lead.id,
      customerId: customerId ?? undefined,
      accountId: dto.accountId,
      valueMinor: dto.valueMinor,
      expectedCloseAt: dto.expectedCloseAt,
      ownerUserId: lead.assignedUserId ?? actor.userId,
      stage: OpportunityStage.QUALIFIED,
    });
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateOpportunityDto) {
    const current = await this.get(actor, id);
    await this.assertLinks(actor.tenantId, dto);
    let stageData: StageChange = {};
    if (dto.stage && dto.stage !== current.stage) {
      stageData = stageTransition(current, dto.stage, dto.lostReason ?? current.lostReason ?? undefined);
    } else if (dto.lostReason !== undefined && current.stage === OpportunityStage.LOST) {
      stageData = { lostReason: dto.lostReason };
    }
    return this.prisma.client.opportunity.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.accountId !== undefined ? { accountId: dto.accountId || null } : {}),
        ...(dto.customerId !== undefined ? { customerId: dto.customerId || null } : {}),
        ...(dto.leadId !== undefined ? { leadId: dto.leadId || null } : {}),
        ...(dto.valueMinor !== undefined ? { valueMinor: dto.valueMinor } : {}),
        ...(dto.expectedCloseAt !== undefined
          ? { expectedCloseAt: dto.expectedCloseAt ? new Date(dto.expectedCloseAt) : null }
          : {}),
        ...(dto.ownerUserId !== undefined ? { ownerUserId: dto.ownerUserId || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...stageData,
        // Explicit probability wins over the stage default.
        ...(dto.probabilityPct !== undefined ? { probabilityPct: dto.probabilityPct } : {}),
        updatedBy: actor.userId,
      },
      include: OPPORTUNITY_INCLUDE,
    });
  }

  async changeStage(actor: AuthPrincipal, id: string, dto: ChangeStageDto) {
    const current = await this.get(actor, id);
    const data = stageTransition(current, dto.stage, dto.lostReason);
    return this.prisma.client.opportunity.update({
      where: { id },
      data: { ...data, updatedBy: actor.userId },
      include: OPPORTUNITY_INCLUDE,
    });
  }

  async remove(actor: AuthPrincipal, id: string) {
    await this.get(actor, id);
    await this.prisma.client.opportunity.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.userId, updatedBy: actor.userId },
    });
    return { ok: true as const };
  }

  private async assertLinks(
    tenantId: string,
    dto: { accountId?: string; customerId?: string; leadId?: string },
  ) {
    const checks: Promise<void>[] = [];
    if (dto.accountId) {
      checks.push(
        this.prisma.client.account
          .findFirst({ where: { id: dto.accountId, tenantId, deletedAt: null }, select: { id: true } })
          .then((r) => {
            if (!r) throw new BadRequestException('Account not found');
          }),
      );
    }
    if (dto.customerId) {
      checks.push(
        this.prisma.client.customer
          .findFirst({ where: { id: dto.customerId, tenantId, deletedAt: null }, select: { id: true } })
          .then((r) => {
            if (!r) throw new BadRequestException('Customer not found');
          }),
      );
    }
    if (dto.leadId) {
      checks.push(
        this.prisma.client.lead
          .findFirst({ where: { id: dto.leadId, tenantId, deletedAt: null }, select: { id: true } })
          .then((r) => {
            if (!r) throw new BadRequestException('Lead not found');
          }),
      );
    }
    await Promise.all(checks);
  }
}

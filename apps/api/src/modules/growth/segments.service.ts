import type { AuthPrincipal } from '@ac/auth';
import type { Prisma } from '@ac/database';
import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { CreateSegmentDto, UpdateSegmentDto } from './dto/growth.dto';
import { buildSegmentWhere, parseSegmentRules, type SegmentRules } from './growth.rules';

const SAMPLE_SELECT = {
  id: true,
  fullName: true,
  phone: true,
  email: true,
  cityId: true,
  tags: true,
  totalBookings: true,
} satisfies Prisma.CustomerSelect;

@Injectable()
export class SegmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AuthPrincipal, page: number, pageSize: number, search?: string) {
    const where: Prisma.CustomerSegmentWhereInput = {
      tenantId: actor.tenantId,
      deletedAt: null,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.customerSegment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { campaigns: true } } },
      }),
      this.prisma.client.customerSegment.count({ where }),
    ]);
    return { items, total };
  }

  async get(actor: AuthPrincipal, id: string) {
    const row = await this.prisma.client.customerSegment.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Segment not found');
    return row;
  }

  async create(actor: AuthPrincipal, dto: CreateSegmentDto) {
    const rules = parseSegmentRules(dto.rules);
    const memberCount = await this.count(actor.tenantId, rules);
    return this.prisma.client.customerSegment.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name,
        description: dto.description ?? null,
        rules: rules as Prisma.InputJsonValue,
        memberCount,
        lastComputedAt: new Date(),
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateSegmentDto) {
    await this.get(actor, id);
    const data: Prisma.CustomerSegmentUpdateInput = { updatedBy: actor.userId };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.rules !== undefined) {
      const rules = parseSegmentRules(dto.rules);
      data.rules = rules as Prisma.InputJsonValue;
      data.memberCount = await this.count(actor.tenantId, rules);
      data.lastComputedAt = new Date();
    }
    return this.prisma.client.customerSegment.update({ where: { id }, data });
  }

  async remove(actor: AuthPrincipal, id: string) {
    await this.get(actor, id);
    await this.prisma.client.customerSegment.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.userId },
    });
    return { ok: true as const };
  }

  async previewRules(tenantId: string, rawRules: unknown, sampleSize = 20) {
    const rules = parseSegmentRules(rawRules);
    const where = buildSegmentWhere(tenantId, rules);
    const [count, sample] = await Promise.all([
      this.prisma.client.customer.count({ where }),
      this.prisma.client.customer.findMany({
        where,
        select: SAMPLE_SELECT,
        orderBy: { createdAt: 'desc' },
        take: sampleSize,
      }),
    ]);
    return { count, sample, rules };
  }

  async previewSaved(actor: AuthPrincipal, id: string) {
    const seg = await this.get(actor, id);
    const result = await this.previewRules(actor.tenantId, seg.rules);
    await this.prisma.client.customerSegment.update({
      where: { id },
      data: { memberCount: result.count, lastComputedAt: new Date() },
    });
    return result;
  }

  count(tenantId: string, rules: SegmentRules): Promise<number> {
    return this.prisma.client.customer.count({ where: buildSegmentWhere(tenantId, rules) });
  }

  /** Iterate segment members in id order, `batch` at a time. */
  async *iterateMembers(tenantId: string, rawRules: unknown, batch = 500) {
    const where = buildSegmentWhere(tenantId, parseSegmentRules(rawRules));
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.prisma.client.customer.findMany({
        where,
        select: { id: true, userId: true, fullName: true, phone: true, email: true, preferences: true, preferredLanguage: true },
        orderBy: { id: 'asc' },
        take: batch,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (rows.length === 0) return;
      yield rows;
      if (rows.length < batch) return;
      cursor = rows[rows.length - 1]!.id;
    }
  }
}

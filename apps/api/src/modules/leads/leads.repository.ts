import { Injectable } from '@nestjs/common';
import { LeadStatus } from '@ac/types';
import type { Lead, Prisma } from '@ac/database';

import { PrismaService } from '../../common/prisma/prisma.service';
import { type ListLeadsDto } from './dto/list-leads.dto';

const LEAD_INCLUDE = {
  city: { select: { id: true, name: true, state: true } },
  assignedUser: {
    select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
  },
  _count: { select: { notes: true, activities: true } },
} satisfies Prisma.LeadInclude;

export type LeadWithRelations = Prisma.LeadGetPayload<{ include: typeof LEAD_INCLUDE }>;

/**
 * Data access for the Lead aggregate. Repository owns Prisma; the service
 * stays pure and easier to test by mocking this layer.
 */
@Injectable()
export class LeadsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.LeadCreateInput, tx?: Prisma.TransactionClient): Promise<Lead> {
    return (tx ?? this.prisma.client).lead.create({ data });
  }

  findById(tenantId: string, id: string): Promise<LeadWithRelations | null> {
    return this.prisma.client.lead.findFirst({
      where: { id, tenantId },
      include: LEAD_INCLUDE,
    });
  }

  findByExternalRef(tenantId: string, externalRef: string): Promise<Lead | null> {
    return this.prisma.client.lead.findFirst({
      where: { tenantId, externalRef },
    });
  }

  /**
   * Heuristic duplicate detection: same tenant, same phone, status not
   * terminal, created within the last 24h. Used to short-circuit accidental
   * re-submissions from ad forms / webhooks.
   */
  findRecentDuplicate(tenantId: string, phone: string): Promise<Lead | null> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.prisma.client.lead.findFirst({
      where: {
        tenantId,
        phone,
        status: { in: [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED] },
        createdAt: { gte: cutoff },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async list(
    tenantId: string,
    query: ListLeadsDto,
  ): Promise<{ items: LeadWithRelations[]; total: number }> {
    const where: Prisma.LeadWhereInput = {
      tenantId,
      ...(query.status?.length ? { status: { in: query.status } } : {}),
      ...(query.source?.length ? { source: { in: query.source } } : {}),
      ...(query.priority?.length ? { priority: { in: query.priority } } : {}),
      ...(query.cityId ? { cityId: query.cityId } : {}),
      ...(query.assignedUserId ? { assignedUserId: query.assignedUserId } : {}),
      ...(query.tags?.length ? { tags: { hasSome: query.tags } } : {}),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
              ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { customerName: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.lead.findMany({
        where,
        include: LEAD_INCLUDE,
        orderBy: this.parseSort(query.sort ?? 'createdAt:desc'),
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.client.lead.count({ where }),
    ]);

    return { items, total };
  }

  update(id: string, data: Prisma.LeadUpdateInput, tx?: Prisma.TransactionClient): Promise<Lead> {
    return (tx ?? this.prisma.client).lead.update({ where: { id }, data });
  }

  softDelete(id: string): Promise<Lead> {
    return this.prisma.client.lead.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  addNote(input: {
    leadId: string;
    tenantId: string;
    authorUserId: string;
    body: string;
  }) {
    return this.prisma.client.leadNote.create({
      data: {
        leadId: input.leadId,
        tenantId: input.tenantId,
        authorUserId: input.authorUserId,
        body: input.body,
      },
    });
  }

  listNotes(leadId: string) {
    return this.prisma.client.leadNote.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  private parseSort(input: string): Prisma.LeadOrderByWithRelationInput[] {
    const allowed = new Set([
      'createdAt',
      'updatedAt',
      'priority',
      'status',
      'code',
      'customerName',
    ]);
    return input
      .split(',')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => {
        const [field, dir] = segment.split(':');
        if (!field || !allowed.has(field)) return null;
        const direction: Prisma.SortOrder = dir === 'asc' ? 'asc' : 'desc';
        return { [field]: direction } as Prisma.LeadOrderByWithRelationInput;
      })
      .filter((v): v is Prisma.LeadOrderByWithRelationInput => v !== null);
  }

  /** Atomic, race-safe code allocator: LD-{YYYY}-{seq}. */
  async nextCode(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    // Postgres advisory lock keyed on tenant+year keeps concurrent inserts safe.
    const lockKey = hashKey(`${tenantId}:lead:${year}`);
    return this.prisma.client.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${lockKey})`);
      const count = await tx.lead.count({
        where: { tenantId, code: { startsWith: `LD-${year}-` } },
      });
      const seq = String(count + 1).padStart(6, '0');
      return `LD-${year}-${seq}`;
    });
  }
}

/** Stable 64-bit hash for advisory locks. */
function hashKey(input: string): bigint {
  let h = 0n;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31n + BigInt(input.charCodeAt(i))) & 0x7fffffffffffffffn;
  }
  return h;
}

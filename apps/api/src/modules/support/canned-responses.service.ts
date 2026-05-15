import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { CannedResponseScope } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  CreateCannedResponseDto,
  ListCannedResponsesDto,
  UpdateCannedResponseDto,
} from './dto/canned-response.dto';

@Injectable()
export class CannedResponsesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    actor: AuthPrincipal,
    dto: ListCannedResponsesDto,
  ): Promise<{ items: unknown[]; page: number; pageSize: number; total: number }> {
    const where: Prisma.CannedResponseWhereInput = {
      tenantId: actor.tenantId,
      deletedAt: null,
    };
    if (dto.scope) where.scope = dto.scope;
    if (dto.team) where.team = dto.team;
    if (dto.channel) where.channels = { has: dto.channel };
    if (dto.tag) where.tags = { has: dto.tag };
    if (dto.search) {
      where.OR = [
        { code: { contains: dto.search, mode: 'insensitive' } },
        { title: { contains: dto.search, mode: 'insensitive' } },
        { body: { contains: dto.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.cannedResponse.findMany({
        where,
        orderBy: [{ usageCount: 'desc' }, { title: 'asc' }],
        skip: dto.skip,
        take: dto.pageSize,
      }),
      this.prisma.client.cannedResponse.count({ where }),
    ]);
    return { items, page: dto.page, pageSize: dto.pageSize, total };
  }

  async create(
    actor: AuthPrincipal,
    dto: CreateCannedResponseDto,
  ): Promise<{ id: string }> {
    return this.prisma.client.cannedResponse.create({
      data: {
        tenantId: actor.tenantId,
        code: dto.code,
        title: dto.title,
        body: dto.body,
        scope: dto.scope ?? CannedResponseScope.GLOBAL,
        team: dto.team,
        ownerUserId: dto.scope === CannedResponseScope.PRIVATE ? actor.userId : null,
        channels: dto.channels ?? [],
        tags: dto.tags ?? [],
        isActive: dto.isActive ?? true,
      },
      select: { id: true },
    });
  }

  async update(
    actor: AuthPrincipal,
    id: string,
    dto: UpdateCannedResponseDto,
  ): Promise<void> {
    await this.require(actor.tenantId, id);
    await this.prisma.client.cannedResponse.update({
      where: { id },
      data: {
        title: dto.title,
        body: dto.body,
        scope: dto.scope,
        team: dto.team,
        channels: dto.channels,
        tags: dto.tags,
        isActive: dto.isActive,
      },
    });
  }

  async delete(actor: AuthPrincipal, id: string): Promise<void> {
    await this.require(actor.tenantId, id);
    await this.prisma.client.cannedResponse.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async incrementUsage(actor: AuthPrincipal, id: string): Promise<void> {
    await this.require(actor.tenantId, id);
    await this.prisma.client.cannedResponse.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    });
  }

  private async require(
    tenantId: string,
    id: string,
  ): Promise<{ id: string }> {
    const row = await this.prisma.client.cannedResponse.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Canned response not found');
    return row;
  }
}

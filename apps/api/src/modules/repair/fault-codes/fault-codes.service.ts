import type { AuthPrincipal } from '@ac/auth';
import type { Prisma } from '@ac/database';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { compact, isUniqueViolation, toNullableString } from '../domain/util';
import { CreateFaultCodeDto, ListFaultCodesDto, UpdateFaultCodeDto } from './dto/fault-code.dto';

@Injectable()
export class FaultCodesService {
  constructor(private readonly prisma: PrismaService) {}

  list(actor: AuthPrincipal, query: ListFaultCodesDto) {
    const q = query.q?.trim();
    const brand = query.brand?.trim();
    const and: Prisma.FaultCodeWhereInput[] = [];
    if (brand) {
      and.push({ OR: [{ brand: null }, { brand: { equals: brand, mode: 'insensitive' } }] });
    }
    if (q) {
      and.push({
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    return this.prisma.client.faultCode.findMany({
      where: {
        tenantId: actor.tenantId,
        deletedAt: null,
        ...(query.category ? { category: query.category } : {}),
        ...(query.active !== undefined ? { isActive: query.active } : {}),
        ...(and.length ? { AND: and } : {}),
      },
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
  }

  async get(actor: AuthPrincipal, id: string) {
    const row = await this.prisma.client.faultCode.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Fault code not found');
    return row;
  }

  async create(actor: AuthPrincipal, dto: CreateFaultCodeDto) {
    const code = dto.code.trim().toUpperCase();
    const data = {
      brand: toNullableString(dto.brand) ?? null,
      title: dto.title.trim(),
      description: toNullableString(dto.description) ?? null,
      suggestedFix: toNullableString(dto.suggestedFix) ?? null,
      isActive: dto.isActive ?? true,
    };
    const existing = await this.prisma.client.faultCode.findUnique({
      where: {
        tenantId_category_code: { tenantId: actor.tenantId, category: dto.category, code },
      },
      select: { id: true, deletedAt: true },
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException(`Fault code ${code} already exists for ${dto.category}`);
    }
    if (existing) {
      return this.prisma.client.faultCode.update({
        where: { id: existing.id },
        data: { ...data, deletedAt: null },
      });
    }
    try {
      return await this.prisma.client.faultCode.create({
        data: { ...data, tenantId: actor.tenantId, category: dto.category, code },
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException(`Fault code ${code} already exists`);
      throw err;
    }
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateFaultCodeDto) {
    await this.get(actor, id);
    const data = compact({
      category: dto.category,
      code: dto.code?.trim().toUpperCase(),
      brand: toNullableString(dto.brand),
      title: dto.title?.trim(),
      description: toNullableString(dto.description),
      suggestedFix: toNullableString(dto.suggestedFix),
      isActive: dto.isActive,
    });
    try {
      return await this.prisma.client.faultCode.update({
        where: { id },
        data: data,
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('Fault code already exists');
      throw err;
    }
  }

  async remove(actor: AuthPrincipal, id: string) {
    await this.get(actor, id);
    await this.prisma.client.faultCode.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { id, deleted: true };
  }
}

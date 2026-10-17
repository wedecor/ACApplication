import type { AuthPrincipal } from '@ac/auth';
import type { Prisma } from '@ac/database';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { duplicateItemKeys } from '../domain/checklist';
import { compact } from '../domain/util';
import {
  type ChecklistItemDto,
  CreateChecklistTemplateDto,
  ListChecklistsDto,
  UpdateChecklistTemplateDto,
} from './dto/checklist.dto';

@Injectable()
export class ChecklistsService {
  constructor(private readonly prisma: PrismaService) {}

  list(actor: AuthPrincipal, query: ListChecklistsDto) {
    return this.prisma.client.checklistTemplate.findMany({
      where: {
        tenantId: actor.tenantId,
        deletedAt: null,
        ...(query.category ? { category: query.category } : {}),
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.active !== undefined ? { isActive: query.active } : {}),
      },
      orderBy: [{ category: 'asc' }, { kind: 'asc' }, { name: 'asc' }],
    });
  }

  /** Active templates for a category — what a technician fills on a job card. */
  activeForCategory(tenantId: string, category: string) {
    return this.prisma.client.checklistTemplate.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
        category: category as Prisma.ChecklistTemplateWhereInput['category'],
      },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });
  }

  async get(actor: AuthPrincipal, id: string) {
    const row = await this.prisma.client.checklistTemplate.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Checklist template not found');
    return row;
  }

  create(actor: AuthPrincipal, dto: CreateChecklistTemplateDto) {
    return this.prisma.client.checklistTemplate.create({
      data: {
        tenantId: actor.tenantId,
        category: dto.category,
        kind: dto.kind,
        name: dto.name.trim(),
        items: this.normaliseItems(dto.items),
        isActive: dto.isActive ?? true,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateChecklistTemplateDto) {
    await this.get(actor, id);
    const data = compact({
      category: dto.category,
      kind: dto.kind,
      name: dto.name?.trim(),
      isActive: dto.isActive,
      items: dto.items
        ? (this.normaliseItems(dto.items) as unknown as Prisma.InputJsonValue)
        : undefined,
    });
    return this.prisma.client.checklistTemplate.update({
      where: { id },
      data: {
        ...(data as Prisma.ChecklistTemplateUpdateInput),
        // Bump the version whenever the item list changes so filled job
        // cards can tell which revision they were answered against.
        ...(dto.items ? { version: { increment: 1 } } : {}),
        updatedBy: actor.userId,
      },
    });
  }

  async remove(actor: AuthPrincipal, id: string) {
    await this.get(actor, id);
    await this.prisma.client.checklistTemplate.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, updatedBy: actor.userId },
    });
    return { id, deleted: true };
  }

  private normaliseItems(items: ChecklistItemDto[]) {
    const dupes = duplicateItemKeys(items);
    if (dupes.length) {
      throw new BadRequestException({
        message: `Duplicate checklist item keys: ${dupes.join(', ')}`,
        code: 'CHECKLIST_DUPLICATE_KEYS',
      });
    }
    return items.map((i) => ({
      key: i.key,
      label: i.label.trim(),
      type: i.type,
      ...(i.unit ? { unit: i.unit } : {}),
      required: !!i.required,
    }));
  }
}

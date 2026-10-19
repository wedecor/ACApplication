import type { AuthPrincipal } from '@ac/auth';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma,TaskStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { CreateTaskDto, ListTasksDto, TaskEntityType, UpdateTaskDto } from './dto/task.dto';

export const ACTIVE_TASK_STATUSES: TaskStatus[] = [TaskStatus.OPEN, TaskStatus.IN_PROGRESS];

/** Pure where-builder for task lists (exported for tests). */
export function buildTaskWhere(
  actor: Pick<AuthPrincipal, 'tenantId' | 'userId'>,
  query: Pick<
    ListTasksDto,
    'scope' | 'status' | 'overdue' | 'entityType' | 'entityId' | 'assigneeUserId' | 'search'
  >,
  now: Date = new Date(),
): Prisma.TaskWhereInput {
  const scope = query.scope ?? 'mine';
  const where: Prisma.TaskWhereInput = { tenantId: actor.tenantId, deletedAt: null };
  if (scope === 'mine') where.assigneeUserId = actor.userId;
  else if (query.assigneeUserId) where.assigneeUserId = query.assigneeUserId;
  if (query.status) where.status = query.status;
  if (query.overdue) {
    where.dueAt = { lt: now };
    where.status = query.status && ACTIVE_TASK_STATUSES.includes(query.status)
      ? query.status
      : { in: ACTIVE_TASK_STATUSES };
  }
  if (query.entityType) where.entityType = query.entityType;
  if (query.entityId) where.entityId = query.entityId;
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  return where;
}

function parseDate(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return new Date(v);
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AuthPrincipal, query: ListTasksDto) {
    const where = buildTaskWhere(actor, query);
    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.task.findMany({
        where,
        orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.client.task.count({ where }),
    ]);
    return { items: await this.withAssignees(rows), total };
  }

  async summary(actor: AuthPrincipal, now: Date = new Date()) {
    const base: Prisma.TaskWhereInput = {
      tenantId: actor.tenantId,
      deletedAt: null,
      status: { in: ACTIVE_TASK_STATUSES },
    };
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
    const [open, overdue, dueToday, mineOpen] = await Promise.all([
      this.prisma.client.task.count({ where: base }),
      this.prisma.client.task.count({ where: { ...base, dueAt: { lt: now } } }),
      this.prisma.client.task.count({ where: { ...base, dueAt: { gte: startOfDay, lt: endOfDay } } }),
      this.prisma.client.task.count({ where: { ...base, assigneeUserId: actor.userId } }),
    ]);
    return { open, overdue, dueToday, mineOpen };
  }

  async get(actor: AuthPrincipal, id: string) {
    const row = await this.findOrThrow(actor.tenantId, id);
    const [withAssignee] = await this.withAssignees([row]);
    return withAssignee!;
  }

  async create(actor: AuthPrincipal, dto: CreateTaskDto) {
    this.assertEntityPair(dto.entityType, dto.entityId);
    if (dto.entityType && dto.entityId) {
      await this.assertEntityExists(actor.tenantId, dto.entityType, dto.entityId);
    }
    const assigneeUserId = dto.assigneeUserId ?? actor.userId;
    await this.assertAssignee(actor.tenantId, assigneeUserId);
    const row = await this.prisma.client.task.create({
      data: {
        tenantId: actor.tenantId,
        title: dto.title.trim(),
        description: dto.description ?? null,
        priority: dto.priority,
        dueAt: parseDate(dto.dueAt) ?? null,
        reminderAt: parseDate(dto.reminderAt) ?? null,
        assigneeUserId,
        entityType: dto.entityType ?? null,
        entityId: dto.entityId ?? null,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });
    return this.get(actor, row.id);
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateTaskDto) {
    const current = await this.findOrThrow(actor.tenantId, id);
    const entityType = dto.entityType ?? (current.entityType as TaskEntityType | null) ?? undefined;
    const entityId = dto.entityId ?? current.entityId ?? undefined;
    if (dto.entityType !== undefined || dto.entityId !== undefined) {
      this.assertEntityPair(entityType, entityId);
      if (entityType && entityId) await this.assertEntityExists(actor.tenantId, entityType, entityId);
    }
    if (dto.assigneeUserId) await this.assertAssignee(actor.tenantId, dto.assigneeUserId);

    const data: Prisma.TaskUpdateInput = { updatedBy: actor.userId };
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.dueAt !== undefined) data.dueAt = parseDate(dto.dueAt);
    if (dto.reminderAt !== undefined) {
      const next = parseDate(dto.reminderAt);
      data.reminderAt = next;
      if ((next?.getTime() ?? null) !== (current.reminderAt?.getTime() ?? null)) {
        data.reminderSentAt = null;
      }
    }
    if (dto.assigneeUserId !== undefined) {
      data.assigneeUserId = dto.assigneeUserId;
      if (dto.assigneeUserId !== current.assigneeUserId) data.reminderSentAt = null;
    }
    if (dto.entityType !== undefined) data.entityType = dto.entityType;
    if (dto.entityId !== undefined) data.entityId = dto.entityId;
    if (dto.status !== undefined && dto.status !== current.status) {
      data.status = dto.status;
      data.completedAt = dto.status === TaskStatus.DONE ? new Date() : null;
    }
    await this.prisma.client.task.update({ where: { id }, data });
    return this.get(actor, id);
  }

  async complete(actor: AuthPrincipal, id: string) {
    const current = await this.findOrThrow(actor.tenantId, id);
    if (current.status === TaskStatus.DONE) return this.get(actor, id);
    if (current.status === TaskStatus.CANCELLED) {
      throw new BadRequestException('Cannot complete a cancelled task');
    }
    await this.prisma.client.task.update({
      where: { id },
      data: { status: TaskStatus.DONE, completedAt: new Date(), updatedBy: actor.userId },
    });
    return this.get(actor, id);
  }

  async remove(actor: AuthPrincipal, id: string) {
    await this.findOrThrow(actor.tenantId, id);
    await this.prisma.client.task.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.userId, updatedBy: actor.userId },
    });
    return { ok: true as const };
  }

  private async withAssignees<T extends { assigneeUserId: string | null }>(rows: T[]) {
    const ids = [...new Set(rows.map((r) => r.assigneeUserId).filter((v): v is string => !!v))];
    const users = ids.length
      ? await this.prisma.client.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => ({
      ...r,
      assignee: r.assigneeUserId ? byId.get(r.assigneeUserId) ?? null : null,
    }));
  }

  private assertEntityPair(entityType?: string | null, entityId?: string | null) {
    if (!!entityType !== !!entityId) {
      throw new BadRequestException('entityType and entityId must be provided together');
    }
  }

  private async assertAssignee(tenantId: string, userId: string) {
    const user = await this.prisma.client.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new BadRequestException('Assignee not found');
  }

  private async assertEntityExists(tenantId: string, type: TaskEntityType, id: string) {
    const where = { id, tenantId, deletedAt: null };
    const select = { id: true } as const;
    let found: { id: string } | null;
    switch (type) {
      case 'lead':
        found = await this.prisma.client.lead.findFirst({ where, select });
        break;
      case 'customer':
        found = await this.prisma.client.customer.findFirst({ where, select });
        break;
      case 'booking':
        found = await this.prisma.client.booking.findFirst({ where, select });
        break;
      case 'ticket':
        found = await this.prisma.client.supportTicket.findFirst({ where, select });
        break;
      case 'opportunity':
        found = await this.prisma.client.opportunity.findFirst({ where, select });
        break;
      case 'account':
        found = await this.prisma.client.account.findFirst({ where, select });
        break;
      default:
        found = null;
    }
    if (!found) throw new BadRequestException(`Linked ${type} not found`);
  }

  private async findOrThrow(tenantId: string, id: string) {
    const row = await this.prisma.client.task.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!row) throw new NotFoundException('Task not found');
    return row;
  }
}

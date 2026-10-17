import { BadRequestException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';

import { buildTaskWhere, TasksService } from '../tasks.service';

const actor = {
  userId: 'user_1',
  tenantId: 'tenant_1',
  sessionId: 's',
  roles: [],
  permissions: [],
  email: null,
  phone: null,
  permissionVersion: 1,
  iat: 0,
  exp: 0,
} as never;

describe('buildTaskWhere', () => {
  const now = new Date('2026-05-01T10:00:00Z');

  it('defaults to my tasks', () => {
    expect(buildTaskWhere(actor, {}, now)).toEqual({
      tenantId: 'tenant_1',
      deletedAt: null,
      assigneeUserId: 'user_1',
    });
  });

  it('overdue = due in the past and still active', () => {
    const where = buildTaskWhere(actor, { scope: 'all', overdue: true }, now);
    expect(where.dueAt).toEqual({ lt: now });
    expect(where.status).toEqual({ in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] });
    expect(where.assigneeUserId).toBeUndefined();
  });

  it('filters by linked entity and assignee in all scope', () => {
    const where = buildTaskWhere(
      actor,
      { scope: 'all', entityType: 'booking', entityId: 'b1', assigneeUserId: 'u2' },
      now,
    );
    expect(where).toMatchObject({ entityType: 'booking', entityId: 'b1', assigneeUserId: 'u2' });
  });
});

describe('TasksService', () => {
  function build(task: Record<string, unknown>) {
    const prisma = {
      client: {
        task: {
          findFirst: jest.fn().mockResolvedValue(task),
          update: jest.fn().mockResolvedValue(task),
        },
        user: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue({ id: 'u' }) },
        booking: { findFirst: jest.fn().mockResolvedValue(null) },
      },
    };
    return { service: new TasksService(prisma as never), prisma };
  }

  it('complete marks DONE with completedAt', async () => {
    const { service, prisma } = build({ id: 't1', status: 'OPEN', assigneeUserId: null });
    await service.complete(actor, 't1');
    const data = prisma.client.task.update.mock.calls[0][0].data;
    expect(data.status).toBe('DONE');
    expect(data.completedAt).toBeInstanceOf(Date);
  });

  it('complete refuses cancelled tasks', async () => {
    const { service } = build({ id: 't1', status: 'CANCELLED', assigneeUserId: null });
    await expect(service.complete(actor, 't1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resets reminderSentAt when reminderAt changes', async () => {
    const { service, prisma } = build({
      id: 't1',
      status: 'OPEN',
      assigneeUserId: 'user_1',
      reminderAt: new Date('2026-01-01T00:00:00Z'),
      reminderSentAt: new Date(),
    });
    await service.update(actor, 't1', { reminderAt: '2026-02-01T00:00:00Z' });
    const data = prisma.client.task.update.mock.calls[0][0].data;
    expect(data.reminderSentAt).toBeNull();
  });

  it('rejects a link to a missing entity', async () => {
    const { service } = build({ id: 't1' });
    await expect(
      service.create(actor, { title: 'Call back', entityType: 'booking', entityId: 'nope' }),
    ).rejects.toThrow('Linked booking not found');
  });
});

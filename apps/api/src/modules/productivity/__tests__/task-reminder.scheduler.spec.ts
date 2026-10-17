import { TaskReminderScheduler } from '../task-reminder.scheduler';

describe('TaskReminderScheduler', () => {
  const reminderAt = new Date('2026-05-01T09:00:00Z');
  const now = new Date('2026-05-01T09:01:00Z');

  function build(claimCounts: number[]) {
    const prisma = {
      client: {
        task: {
          findMany: jest.fn().mockResolvedValue([
            { id: 't1', tenantId: 'ten', title: 'Call', dueAt: null, reminderAt, assigneeUserId: 'u1' },
            { id: 't2', tenantId: 'ten', title: 'Visit', dueAt: reminderAt, reminderAt, assigneeUserId: 'u2' },
          ]),
          updateMany: jest.fn(),
        },
        user: {
          findUnique: jest.fn().mockImplementation(({ where }) =>
            Promise.resolve({ id: where.id, email: `${where.id}@x.test` }),
          ),
        },
      },
    };
    claimCounts.forEach((count) => prisma.client.task.updateMany.mockResolvedValueOnce({ count }));
    const notifications = { enqueue: jest.fn().mockResolvedValue(['n1']) };
    return { scheduler: new TaskReminderScheduler(prisma as never, notifications as never), prisma, notifications };
  }

  it('claims each task then enqueues an idempotent reminder', async () => {
    const { scheduler, prisma, notifications } = build([1, 1]);
    const sent = await scheduler.sendDueReminders(now);
    expect(sent).toBe(2);
    expect(prisma.client.task.findMany.mock.calls[0][0].where).toMatchObject({
      reminderAt: { lte: now },
      reminderSentAt: null,
    });
    expect(prisma.client.task.updateMany).toHaveBeenCalledWith({
      where: { id: 't1', reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    expect(notifications.enqueue).toHaveBeenCalledWith(
      'ten',
      { userId: 'u1', email: 'u1@x.test' },
      ['IN_APP', 'PUSH'],
      expect.objectContaining({
        template: 'task.reminder',
        idempotencyKey: `task-reminder:t1:${reminderAt.getTime()}`,
      }),
    );
  });

  it('skips tasks already claimed by another instance', async () => {
    const { scheduler, notifications } = build([0, 1]);
    expect(await scheduler.sendDueReminders(now)).toBe(1);
    expect(notifications.enqueue).toHaveBeenCalledTimes(1);
  });

  it('survives enqueue failures', async () => {
    const { scheduler, notifications } = build([1, 1]);
    notifications.enqueue.mockRejectedValueOnce(new Error('redis down'));
    expect(await scheduler.sendDueReminders(now)).toBe(1);
  });
});

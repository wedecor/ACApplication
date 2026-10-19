import { NotificationChannel } from '@ac/types';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../common/prisma/prisma.service';
import { HOLD, SingleInstance } from '../../common/scheduling/single-instance';
import { NotificationsService } from '../notifications/notifications.service';
import { ACTIVE_TASK_STATUSES } from './tasks.service';

/**
 * Sends a reminder (in-app + push) to the assignee once a task's
 * `reminderAt` passes. Each task is claimed atomically by stamping
 * `reminderSentAt` so concurrent instances never double-send.
 */
@Injectable()
export class TaskReminderScheduler {
  private readonly logger = new Logger(TaskReminderScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  @SingleInstance(HOLD.minute)
  async tick(): Promise<void> {
    if (process.env.TASK_REMINDERS_DISABLED === '1') return;
    try {
      const sent = await this.sendDueReminders();
      if (sent > 0) this.logger.log(`Sent ${sent} task reminder(s)`);
    } catch (err) {
      this.logger.warn({ err }, 'Task reminder sweep failed');
    }
  }

  async sendDueReminders(now: Date = new Date()): Promise<number> {
    const due = await this.prisma.client.task.findMany({
      where: {
        deletedAt: null,
        reminderAt: { lte: now },
        reminderSentAt: null,
        status: { in: ACTIVE_TASK_STATUSES },
        assigneeUserId: { not: null },
      },
      select: {
        id: true,
        tenantId: true,
        title: true,
        dueAt: true,
        reminderAt: true,
        assigneeUserId: true,
      },
      orderBy: { reminderAt: 'asc' },
      take: 200,
    });

    let sent = 0;
    for (const task of due) {
      const claim = await this.prisma.client.task.updateMany({
        where: { id: task.id, reminderSentAt: null },
        data: { reminderSentAt: now },
      });
      if (claim.count === 0) continue;

      try {
        const user = await this.prisma.client.user.findUnique({
          where: { id: task.assigneeUserId! },
          select: { id: true, email: true },
        });
        if (!user) continue;
        await this.notifications.enqueue(
          task.tenantId,
          { userId: user.id, email: user.email ?? undefined },
          [NotificationChannel.IN_APP, NotificationChannel.PUSH],
          {
            template: 'task.reminder',
            data: {
              taskId: task.id,
              title: task.title,
              dueAt: task.dueAt ? task.dueAt.toISOString() : null,
            },
            idempotencyKey: `task-reminder:${task.id}:${task.reminderAt!.getTime()}`,
          },
        );
        sent += 1;
      } catch (err) {
        this.logger.warn({ err, taskId: task.id }, 'Task reminder enqueue failed');
      }
    }
    return sent;
  }
}

import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { CustomFieldsController } from './custom-fields.controller';
import { CustomFieldsService } from './custom-fields.service';
import { TaskReminderScheduler } from './task-reminder.scheduler';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

/** Tasks + reminders and tenant-defined custom fields. */
@Module({
  imports: [NotificationsModule],
  controllers: [TasksController, CustomFieldsController],
  providers: [TasksService, TaskReminderScheduler, CustomFieldsService],
  exports: [TasksService, CustomFieldsService],
})
export class ProductivityModule {}

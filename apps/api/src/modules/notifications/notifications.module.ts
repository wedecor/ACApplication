import { forwardRef, Module } from '@nestjs/common';

import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationAdminController } from './notification-admin.controller';
import { NotificationAdminService } from './notification-admin.service';
import { NotificationFailoverDispatcher } from './notification-failover.dispatcher';
import { NotificationListener } from './notification.listener';
import { NotificationMetricsService } from './notification-metrics.service';
import { NotificationQueueService } from './notification-queue.service';
import { NotificationRateLimiterService } from './notification-rate-limiter.service';
import { NotificationRepository } from './notification.repository';
import { NotificationWebhooksController } from './notification-webhooks.controller';
import { NotificationWebhooksService } from './notification-webhooks.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ProviderHealthService } from './provider-health.service';

@Module({
  imports: [forwardRef(() => RealtimeModule)],
  controllers: [
    NotificationsController,
    NotificationWebhooksController,
    NotificationAdminController,
  ],
  providers: [
    NotificationRepository,
    NotificationMetricsService,
    ProviderHealthService,
    NotificationRateLimiterService,
    NotificationQueueService,
    NotificationFailoverDispatcher,
    NotificationsService,
    NotificationWebhooksService,
    NotificationAdminService,
    NotificationListener,
  ],
  exports: [NotificationsService, NotificationRepository, NotificationMetricsService],
})
export class NotificationsModule {}

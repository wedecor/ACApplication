import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { NotificationsModule } from '../notifications/notifications.module';
import { SupportAiHooksService } from './ai-hooks.service';
import { CallCenterController, CallWebhookController } from './call-center.controller';
import { CallCenterService } from './call-center.service';
import { CannedResponsesController } from './canned-responses.controller';
import { CannedResponsesService } from './canned-responses.service';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { CustomerContextService } from './customer-context.service';
import {
  KnowledgeBaseController,
  PublicKnowledgeBaseController,
} from './knowledge-base.controller';
import { KnowledgeBaseService } from './knowledge-base.service';
import { LiveChatGateway } from './live-chat.gateway';
import { MeSupportController } from './me-support.controller';
import { PublicWebChatController } from './public-chat.controller';
import { SlaController } from './sla.controller';
import { SlaService } from './sla.service';
import { SupportAnalyticsController } from './support-analytics.controller';
import { SupportAnalyticsService } from './support-analytics.service';
import { SupportNotificationListener } from './support.notification-listener';
import { SupportSchedulerService } from './support-scheduler.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { WhatsAppInboxService } from './whatsapp-inbox.service';
import { WhatsAppWebhookController } from './whatsapp.controller';

/**
 * Omnichannel Support / Call Center / Ticketing module.
 *
 * Surface area:
 *   - Tickets — CRUD, lifecycle, merge, attachments, CSAT.
 *   - Conversations — omnichannel inbox + inbound adapters (WhatsApp,
 *     email/SMS via the notification dispatcher, live-chat gateway).
 *   - Call center — call logs, dispositions, recordings, click-to-call,
 *     provider webhooks for Exotel/Twilio/Knowlarity.
 *   - SLA profiles + cron-driven scanner with auto-escalation.
 *   - Knowledge base — categories + articles + public reader.
 *   - Canned responses.
 *   - Customer context aggregator.
 *   - Support analytics (CSAT, response/resolution times, channel mix).
 *   - AI hook stubs (sentiment, categorisation, suggested replies).
 *
 * The module is event-driven: every service writes domain events to the
 * `DomainEventBus`, the `RealtimeGateway` broadcasts them, and
 * `SupportNotificationListener` fans them to push / email / WhatsApp.
 */
@Module({
  imports: [ScheduleModule.forRoot(), NotificationsModule],
  providers: [
    TicketsService,
    ConversationsService,
    WhatsAppInboxService,
    CallCenterService,
    SlaService,
    SupportSchedulerService,
    KnowledgeBaseService,
    CannedResponsesService,
    SupportAnalyticsService,
    CustomerContextService,
    SupportAiHooksService,
    SupportNotificationListener,
    LiveChatGateway,
  ],
  controllers: [
    TicketsController,
    ConversationsController,
    WhatsAppWebhookController,
    CallCenterController,
    CallWebhookController,
    SlaController,
    KnowledgeBaseController,
    PublicKnowledgeBaseController,
    PublicWebChatController,
    MeSupportController,
    CannedResponsesController,
    SupportAnalyticsController,
  ],
  exports: [
    TicketsService,
    ConversationsService,
    CallCenterService,
    SlaService,
    KnowledgeBaseService,
    CannedResponsesService,
    SupportAnalyticsService,
    CustomerContextService,
    SupportAiHooksService,
  ],
})
export class SupportModule {}

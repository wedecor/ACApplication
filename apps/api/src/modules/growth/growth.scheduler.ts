import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../common/prisma/prisma.service';
import { CampaignsService } from './campaigns.service';
import { GROWTH_CONFIG, type GrowthConfig } from './growth.config';
import { ReviewsService } from './reviews.service';

/** Default notification templates for growth flows (created only if missing). */
export const GROWTH_TEMPLATES: readonly {
  key: string;
  channel: 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP' | 'IN_APP';
  subject?: string;
  body: string;
}[] = [
  {
    key: 'growth.review_request',
    channel: 'WHATSAPP',
    body: 'Hi {{customerName}}, how was your service ({{bookingCode}})? Rate us 1–5 stars and tell us how likely you are to recommend us (0–10): {{rateUrl}}',
  },
  {
    key: 'growth.review_request',
    channel: 'SMS',
    body: 'Hi {{customerName}}, please rate your service {{bookingCode}}: {{rateUrl}}',
  },
  {
    key: 'growth.google_review',
    channel: 'WHATSAPP',
    body: 'Thank you for the great rating, {{customerName}}! Would you share it on Google? {{reviewUrl}}',
  },
  { key: 'growth.google_review', channel: 'SMS', body: 'Thanks {{customerName}}! Review us on Google: {{reviewUrl}}' },
  { key: 'growth.referral_rewarded', channel: 'PUSH', body: 'Your friend completed their first service — you earned {{points}} points!' },
  { key: 'growth.referral_rewarded', channel: 'IN_APP', body: 'Referral reward: {{points}} points credited.' },
  { key: 'growth.campaign', channel: 'SMS', body: '{{message}}' },
  { key: 'growth.campaign', channel: 'WHATSAPP', body: '{{message}}' },
  { key: 'growth.campaign', channel: 'EMAIL', subject: 'A message for you', body: 'Hi {{customerName}},\n\n{{message}}' },
  { key: 'growth.campaign', channel: 'PUSH', body: '{{message}}' },
  { key: 'growth.campaign', channel: 'IN_APP', body: '{{message}}' },
  // Productivity task reminders (sent by productivity/task-reminder.scheduler).
  { key: 'task.reminder', channel: 'IN_APP', body: 'Reminder: {{title}}' },
  { key: 'task.reminder', channel: 'PUSH', body: 'Task reminder: {{title}}' },
];

@Injectable()
export class GrowthScheduler implements OnModuleInit {
  private readonly logger = new Logger(GrowthScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly campaigns: CampaignsService,
    private readonly reviews: ReviewsService,
    @Inject(GROWTH_CONFIG) private readonly config: GrowthConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    try {
      for (const t of GROWTH_TEMPLATES) {
        await this.prisma.client.notificationTemplate.upsert({
          where: { key_channel_locale: { key: t.key, channel: t.channel, locale: 'en-IN' } },
          create: { key: t.key, channel: t.channel, locale: 'en-IN', subject: t.subject ?? null, body: t.body },
          update: {},
        });
      }
    } catch (err) {
      this.logger.warn({ err }, 'Could not ensure growth notification templates');
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async dueCampaigns(): Promise<void> {
    if (this.config.schedulerDisabled) return;
    try {
      const n = await this.campaigns.runDue();
      if (n > 0) this.logger.log(`Started ${n} scheduled campaign(s)`);
    } catch (err) {
      this.logger.warn({ err }, 'dueCampaigns failed');
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async reviewRequests(): Promise<void> {
    if (this.config.schedulerDisabled) return;
    try {
      const sent = await this.reviews.sweepReviewRequests();
      const followUps = await this.reviews.sweepPublicReviewFollowUps();
      if (sent + followUps > 0) {
        this.logger.log(`Review requests sent=${sent}, google follow-ups=${followUps}`);
      }
    } catch (err) {
      this.logger.warn({ err }, 'reviewRequests sweep failed');
    }
  }
}

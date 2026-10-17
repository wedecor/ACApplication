import { Module } from '@nestjs/common';

import { InvoicesModule } from '../invoices/invoices.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CampaignsService } from './campaigns.service';
import { CouponsService } from './coupons.service';
import { GROWTH_CONFIG, loadGrowthConfig } from './growth.config';
import { GrowthListener } from './growth.listener';
import { GrowthScheduler } from './growth.scheduler';
import {
  CampaignsController,
  CouponsController,
  GrowthAnalyticsController,
  ReferralsAdminController,
  SegmentsController,
} from './growth-admin.controller';
import { LoyaltyService } from './loyalty.service';
import { MeGrowthController } from './me-growth.controller';
import { ReferralsService } from './referrals.service';
import { ReviewsService } from './reviews.service';
import { SegmentsService } from './segments.service';

/**
 * Growth: coupons, referrals, loyalty, segments, campaigns, review/NPS.
 * Cron jobs rely on ScheduleModule.forRoot() registered by FinanceSchedulerModule.
 */
@Module({
  imports: [InvoicesModule, NotificationsModule],
  controllers: [
    CouponsController,
    ReferralsAdminController,
    SegmentsController,
    CampaignsController,
    GrowthAnalyticsController,
    MeGrowthController,
  ],
  providers: [
    { provide: GROWTH_CONFIG, useFactory: loadGrowthConfig },
    CouponsService,
    LoyaltyService,
    ReferralsService,
    SegmentsService,
    CampaignsService,
    ReviewsService,
    GrowthListener,
    GrowthScheduler,
  ],
  exports: [CouponsService, LoyaltyService, ReferralsService, SegmentsService],
})
export class GrowthModule {}

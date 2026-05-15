import { Module } from '@nestjs/common';

import { FinanceAnalyticsController } from './finance-analytics.controller';
import { FinanceAnalyticsService } from './finance-analytics.service';

@Module({
  providers: [FinanceAnalyticsService],
  controllers: [FinanceAnalyticsController],
  exports: [FinanceAnalyticsService],
})
export class FinanceAnalyticsModule {}

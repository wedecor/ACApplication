import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AmcModule } from '../amc/amc.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { QuotationsModule } from '../quotations/quotations.module';
import { FinanceSchedulerService } from './finance-scheduler.service';

@Module({
  imports: [ScheduleModule.forRoot(), AmcModule, PayoutsModule, QuotationsModule],
  providers: [FinanceSchedulerService],
  exports: [FinanceSchedulerService],
})
export class FinanceSchedulerModule {}

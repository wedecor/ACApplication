import { Module } from '@nestjs/common';

import { AmcModule } from '../amc/amc.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { FinanceEventsListener } from './finance-events.listener';

@Module({
  imports: [AmcModule, PayoutsModule],
  providers: [FinanceEventsListener],
})
export class FinanceEventsModule {}

import { Module } from '@nestjs/common';

import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';

@Module({
  providers: [PayoutsService],
  controllers: [PayoutsController],
  exports: [PayoutsService],
})
export class PayoutsModule {}

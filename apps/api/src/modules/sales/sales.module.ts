import { Module } from '@nestjs/common';

import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';

/** B2B accounts (societies, offices, …) and the opportunity pipeline. */
@Module({
  controllers: [AccountsController, OpportunitiesController],
  providers: [AccountsService, OpportunitiesService],
  exports: [AccountsService, OpportunitiesService],
})
export class SalesModule {}

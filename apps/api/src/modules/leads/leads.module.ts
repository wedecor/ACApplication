import { Module } from '@nestjs/common';

import { ActivityModule } from '../activity/activity.module';
import { LeadsController } from './leads.controller';
import { LeadsRepository } from './leads.repository';
import { LeadsService } from './leads.service';

@Module({
  imports: [ActivityModule],
  controllers: [LeadsController],
  providers: [LeadsService, LeadsRepository],
  exports: [LeadsService, LeadsRepository],
})
export class LeadsModule {}

import { Module } from '@nestjs/common';

import { ActivityModule } from '../activity/activity.module';
import { AssignmentModule } from '../assignment/assignment.module';
import { LeadsModule } from '../leads/leads.module';
import { BookingsController } from './bookings.controller';
import { BookingsRepository } from './bookings.repository';
import { BookingsService } from './bookings.service';

@Module({
  imports: [ActivityModule, AssignmentModule, LeadsModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsRepository],
  exports: [BookingsService],
})
export class BookingsModule {}

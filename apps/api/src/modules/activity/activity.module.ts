import { Module } from '@nestjs/common';

import { ActivityService } from './activity.service';

/**
 * Cross-cutting timeline service. Both Lead and Booking modules call it to
 * record activity rows; the UI reads them via the respective domain
 * controllers (no shared HTTP endpoint).
 */
@Module({
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}

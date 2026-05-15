import { Module } from '@nestjs/common';

import { AssignmentModule } from '../assignment/assignment.module';
import { BookingsModule } from '../bookings/bookings.module';
import { TrackingModule } from '../tracking/tracking.module';
import { DispatchController } from './dispatch.controller';
import { DispatchService } from './dispatch.service';

/**
 * Dispatch is the orchestration layer. It composes:
 *   - AssignmentService — raw scoring,
 *   - RoutingService    — ETA / distance / traffic,
 *   - TrackingService   — Redis GEO pre-filter,
 *   - BookingsService   — actually mutating the booking row.
 *
 * It owns the `dispatch_assignments` audit table + dispatch alerts.
 */
@Module({
  imports: [AssignmentModule, BookingsModule, TrackingModule],
  controllers: [DispatchController],
  providers: [DispatchService],
  exports: [DispatchService],
})
export class DispatchModule {}

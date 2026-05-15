import { Module } from '@nestjs/common';

import { TrackingModule } from '../tracking/tracking.module';
import { TechnicianAvailabilityController } from './technician-availability.controller';
import { TechnicianAvailabilityService } from './technician-availability.service';

@Module({
  imports: [TrackingModule],
  controllers: [TechnicianAvailabilityController],
  providers: [TechnicianAvailabilityService],
  exports: [TechnicianAvailabilityService],
})
export class TechnicianAvailabilityModule {}

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { DispatchModule } from '../dispatch/dispatch.module';
import { TechnicianAvailabilityModule } from '../technician-availability/technician-availability.module';
import { SlaMonitorService } from './sla-monitor.service';

/**
 * Cron-driven SLA monitor. Owns four loops:
 *   - tech-stale-sweep  (every 60s)  flips silent techs UNREACHABLE / OFFLINE.
 *   - booking-overdue   (every 60s)  raises BOOKING_OVERDUE alerts.
 *   - delayed-en-route  (every 60s)  detects technicians falling behind ETA.
 *   - daily-aggregate   (every 5m)   rolls today's pings into availability rows.
 */
@Module({
  imports: [ScheduleModule.forRoot(), DispatchModule, TechnicianAvailabilityModule],
  providers: [SlaMonitorService],
  exports: [SlaMonitorService],
})
export class SlaMonitorModule {}

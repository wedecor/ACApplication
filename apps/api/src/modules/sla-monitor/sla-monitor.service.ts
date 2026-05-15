import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  type BookingId,
  BookingStatus,
  DispatchAlertKind,
  DomainEventName,
  type TechnicianId,
} from '@ac/types';

import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { RoutingService } from '../routing/routing.service';
import { TechnicianAvailabilityService } from '../technician-availability/technician-availability.service';

const OVERDUE_GRACE_MIN = 15;
const DELAYED_GRACE_MIN = 10;
const LOW_AVAILABILITY_RATIO = 0.2;

/**
 * Scheduled monitor that powers the dispatcher dashboard's alert panel.
 *
 * Each cron is wrapped in a try/catch so one bad iteration cannot freeze the
 * pipeline (e.g. transient DB blip). Heavy queries are kept narrow via the
 * indexes added in this migration.
 */
@Injectable()
export class SlaMonitorService {
  private readonly logger = new Logger(SlaMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: TechnicianAvailabilityService,
    private readonly dispatch: DispatchService,
    private readonly routing: RoutingService,
    private readonly events: DomainEventBus,
  ) {}

  /** Sweep technicians silent > OFFLINE_TIMEOUT_MS. */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'sla.tech-sweep' })
  async sweepStaleTechs() {
    try {
      const out = await this.availability.sweepStaleTechnicians();
      if (out.flippedUnreachable > 0 || out.closedShifts > 0) {
        this.logger.log({ ...out }, 'tech-sweep');
      }
    } catch (err) {
      this.logger.error({ err }, 'tech-sweep failed');
    }
  }

  /** Alert on bookings past their scheduledAt + grace, still un-finished. */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'sla.booking-overdue' })
  async overdueBookings() {
    try {
      const cutoff = new Date(Date.now() - OVERDUE_GRACE_MIN * 60_000);
      const overdue = await this.prisma.client.booking.findMany({
        where: {
          deletedAt: null,
          status: { in: ['ASSIGNED', 'TECHNICIAN_EN_ROUTE', 'WAITING_PARTS'] },
          scheduledAt: { lt: cutoff },
        },
        take: 200,
      });
      for (const b of overdue) {
        await this.dispatch.raiseAlert({
          tenantId: b.tenantId,
          cityId: b.cityId,
          kind: DispatchAlertKind.BOOKING_OVERDUE,
          severity: 'warning',
          message: `Booking ${b.code} is overdue (${b.status}).`,
          resourceType: 'Booking',
          resourceId: b.id,
          technicianId: b.technicianId ?? null,
          metadata: { scheduledAt: b.scheduledAt.toISOString() },
        });
      }
    } catch (err) {
      this.logger.error({ err }, 'overdue-bookings failed');
    }
  }

  /** Detect technicians en-route who won't make their ETA. */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'sla.delayed-en-route' })
  async delayedEnRoute() {
    try {
      const enRoute = await this.prisma.client.booking.findMany({
        where: {
          deletedAt: null,
          status: BookingStatus.TECHNICIAN_EN_ROUTE,
          technicianId: { not: null },
        },
        include: {
          technician: {
            select: { id: true, lastLatitude: true, lastLongitude: true, lastLocationAt: true },
          },
        },
        take: 100,
      });
      for (const b of enRoute) {
        const tech = b.technician;
        if (!tech?.lastLatitude || !tech.lastLongitude) continue;
        if (b.geoLatitude == null || b.geoLongitude == null) continue;

        const est = await this.routing.estimate(
          { latitude: tech.lastLatitude, longitude: tech.lastLongitude },
          { latitude: b.geoLatitude, longitude: b.geoLongitude },
        );
        const etaIso = new Date(Date.now() + est.durationS * 1000).toISOString();
        const expectedAt = b.scheduledAt.getTime() + DELAYED_GRACE_MIN * 60_000;
        const projectedArrival = Date.now() + est.durationS * 1000;
        if (projectedArrival > expectedAt) {
          const minutesLate = Math.round((projectedArrival - expectedAt) / 60_000);
          await this.dispatch.raiseAlert({
            tenantId: b.tenantId,
            cityId: b.cityId,
            kind: DispatchAlertKind.TECHNICIAN_DELAYED,
            severity: minutesLate > 30 ? 'critical' : 'warning',
            message: `Technician will arrive ${minutesLate} min late for booking ${b.code}.`,
            resourceType: 'Booking',
            resourceId: b.id,
            technicianId: tech.id,
            metadata: { etaIso, projectedArrival: new Date(projectedArrival).toISOString() },
          });
          this.events.publish(DomainEventName.TechnicianDelayed, {
            technicianId: tech.id as TechnicianId,
            bookingId: b.id as BookingId,
            minutesLate,
            etaIso,
          });
        }
      }
    } catch (err) {
      this.logger.error({ err }, 'delayed-en-route failed');
    }
  }

  /** Raise an alert when a city's available pool drops below LOW_AVAILABILITY_RATIO. */
  @Cron('*/5 * * * *', { name: 'sla.low-availability' })
  async lowAvailability() {
    try {
      const cities = await this.prisma.client.city.findMany({ where: { isActive: true } });
      for (const city of cities) {
        const grouped = await this.prisma.client.technician.groupBy({
          by: ['tenantId', 'status'],
          where: { cityId: city.id, deletedAt: null },
          _count: { _all: true },
        });
        const byTenant = new Map<string, { total: number; available: number }>();
        for (const g of grouped) {
          const slot = byTenant.get(g.tenantId) ?? { total: 0, available: 0 };
          slot.total += g._count._all;
          if (g.status === 'AVAILABLE' || g.status === 'ONLINE') slot.available += g._count._all;
          byTenant.set(g.tenantId, slot);
        }
        for (const [tenantId, slot] of byTenant.entries()) {
          if (slot.total === 0) continue;
          const ratio = slot.available / slot.total;
          if (ratio < LOW_AVAILABILITY_RATIO) {
            await this.dispatch.raiseAlert({
              tenantId,
              cityId: city.id,
              kind: DispatchAlertKind.LOW_AVAILABILITY,
              severity: ratio === 0 ? 'critical' : 'warning',
              message: `${city.name}: only ${slot.available}/${slot.total} technicians available.`,
              resourceType: 'City',
              resourceId: city.id,
              metadata: { ratio: Number(ratio.toFixed(2)) },
            });
          }
        }
      }
    } catch (err) {
      this.logger.error({ err }, 'low-availability failed');
    }
  }

  /** Prune expired route-cache rows + roll daily aggregates. */
  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'sla.maintenance' })
  async maintenance() {
    try {
      const pruned = await this.routing.pruneExpired();
      if (pruned > 0) this.logger.debug({ pruned }, 'route-cache pruned');
    } catch (err) {
      this.logger.error({ err }, 'maintenance failed');
    }
  }
}

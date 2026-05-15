import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';

import { ActivityModule } from './modules/activity/activity.module';
import { AmcModule } from './modules/amc/amc.module';
import { AssignmentModule } from './modules/assignment/assignment.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { FinanceAnalyticsModule } from './modules/finance-analytics/finance-analytics.module';
import { FinanceEventsModule } from './modules/finance-events/finance-events.module';
import { FinanceSchedulerModule } from './modules/finance-scheduler/finance-scheduler.module';
import { HealthModule } from './modules/health/health.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { LeadsModule } from './modules/leads/leads.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrchestrationModule } from './modules/orchestration/orchestration.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { PdfModule } from './modules/pdf/pdf.module';
import { PublicIntakeModule } from './modules/public-intake/public-intake.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { RoutingModule } from './modules/routing/routing.module';
import { SlaMonitorModule } from './modules/sla-monitor/sla-monitor.module';
import { SupportModule } from './modules/support/support.module';
import { TechnicianAvailabilityModule } from './modules/technician-availability/technician-availability.module';
import { TechniciansModule } from './modules/technicians/technicians.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { UsersModule } from './modules/users/users.module';
import { ConfigModule } from './common/config/config.module';
import { EventsModule } from './common/events/events.module';
import { LoggerModule } from './common/logger/logger.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { TracingInterceptor } from './common/interceptors/tracing.interceptor';

/**
 * Root module — composes infrastructure modules (config, logger, prisma,
 * redis, throttling) with domain modules (auth, users, customers, etc.).
 *
 * New domain modules go under `src/modules/<domain>` and are imported here.
 */
@Module({
  imports: [
    // Request-scoped storage for actor, requestId, tenantId.
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    ConfigModule,
    LoggerModule,
    PrismaModule,
    RbacModule,
    RedisModule,
    EventsModule,

    // Distributed rate limiting (Redis-backed when REDIS_URL is set).
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 1000,
        limit: Number(process.env['RATE_LIMIT_GLOBAL_RPS'] ?? 100),
      },
    ]),

    // Cross-cutting & domain modules.
    HealthModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    TechniciansModule,
    ActivityModule,
    AssignmentModule,
    LeadsModule,
    BookingsModule,
    RoutingModule,
    TrackingModule,
    TechnicianAvailabilityModule,
    DispatchModule,
    SlaMonitorModule,
    // Finance stack
    PdfModule,
    LedgerModule,
    InvoicesModule,
    QuotationsModule,
    PaymentsModule,
    AmcModule,
    PayoutsModule,
    FinanceAnalyticsModule,
    FinanceEventsModule,
    FinanceSchedulerModule,
    // Inventory / Spare Parts ERP
    InventoryModule,
    // Omnichannel Support / Call Center / Ticketing
    SupportModule,
    NotificationsModule,
    OrchestrationModule,
    RealtimeModule,
    // Public, unauthenticated lead intake for the marketing site / WhatsApp / Ads.
    PublicIntakeModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: TracingInterceptor },
  ],
})
export class AppModule {}

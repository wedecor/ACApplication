import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';

import { ConfigModule } from './common/config/config.module';
import { EventsModule } from './common/events/events.module';
import { TracingInterceptor } from './common/interceptors/tracing.interceptor';
import { LoggerModule } from './common/logger/logger.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { RedisService } from './common/redis/redis.service';
import { SingleInstanceRegistrar } from './common/scheduling/single-instance';
import { AppThrottlerGuard } from './common/throttle/app-throttler.guard';
import { RedisThrottlerStorage } from './common/throttle/redis-throttler.storage';
import { ActivityModule } from './modules/activity/activity.module';
import { AmcModule } from './modules/amc/amc.module';
import { AssignmentModule } from './modules/assignment/assignment.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DataIoModule } from './modules/data-io/data-io.module';
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { FinanceAnalyticsModule } from './modules/finance-analytics/finance-analytics.module';
import { FinanceEventsModule } from './modules/finance-events/finance-events.module';
import { FinanceSchedulerModule } from './modules/finance-scheduler/finance-scheduler.module';
import { GrowthModule } from './modules/growth/growth.module';
import { HealthModule } from './modules/health/health.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { LeadsModule } from './modules/leads/leads.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { MeModule } from './modules/me/me.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrchestrationModule } from './modules/orchestration/orchestration.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { PdfModule } from './modules/pdf/pdf.module';
import { ProductivityModule } from './modules/productivity/productivity.module';
import { PublicIntakeModule } from './modules/public-intake/public-intake.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { RepairModule } from './modules/repair/repair.module';
import { RoutingModule } from './modules/routing/routing.module';
import { SalesModule } from './modules/sales/sales.module';
import { SlaMonitorModule } from './modules/sla-monitor/sla-monitor.module';
import { SupportModule } from './modules/support/support.module';
import { TechnicianAvailabilityModule } from './modules/technician-availability/technician-availability.module';
import { TechniciansModule } from './modules/technicians/technicians.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { UsersModule } from './modules/users/users.module';

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

    // Rate limiting with Redis-backed counters, so limits hold across instances.
    // Per-route @Throttle overrides must use the `global` name to take effect.
    ThrottlerModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [
          {
            name: 'global',
            ttl: 1000,
            limit: Number(process.env.RATE_LIMIT_GLOBAL_RPS ?? 100),
          },
        ],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),

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
    // Customer self-service (/me/*) for the customer app.
    MeModule,
    // Repair domain: appliances, catalog, job cards, warranty, workshop.
    RepairModule,
    // CRM growth / sales / productivity / data import-export.
    GrowthModule,
    SalesModule,
    ProductivityModule,
    DataIoModule,
    // Public, unauthenticated lead intake for the marketing site / WhatsApp / Ads.
    PublicIntakeModule,
  ],
  providers: [
    SingleInstanceRegistrar,
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: TracingInterceptor },
  ],
})
export class AppModule {}

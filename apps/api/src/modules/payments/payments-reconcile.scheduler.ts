/**
 * Payment reconciliation cron.
 *
 * Uses the same `@nestjs/schedule` mechanism as `FinanceSchedulerService`
 * (`ScheduleModule.forRoot()` is registered globally by
 * `FinanceSchedulerModule`, so `@Cron` here is picked up automatically).
 *
 *  • `reconcileStalePayments` every 10 min — asks Razorpay / Stripe for the
 *    truth on txns stuck in PENDING for > PAYMENTS_RECONCILE_STALE_MINUTES.
 *
 * Gated by PAYMENTS_RECONCILE_ENABLED and the shared
 * FINANCE_SCHEDULER_DISABLED=1 kill-switch. A per-process re-entrancy flag
 * stops overlapping ticks; cross-instance safety comes from the
 * status-guarded updates inside `PaymentsService`.
 */

import type { LoadedServerEnv } from '@ac/config';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { APP_CONFIG } from '../../common/config/config.module';
import { PaymentsService, type ReconcileSummary } from './payments.service';

type ReconcileEnv = Pick<
  LoadedServerEnv,
  'PAYMENTS_RECONCILE_ENABLED' | 'PAYMENTS_RECONCILE_STALE_MINUTES' | 'PAYMENTS_RECONCILE_BATCH_SIZE'
>;

@Injectable()
export class PaymentsReconcileScheduler {
  private readonly logger = new Logger(PaymentsReconcileScheduler.name);
  private running = false;

  constructor(
    private readonly payments: PaymentsService,
    @Inject(APP_CONFIG) private readonly env: ReconcileEnv,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'payments.reconcileStale' })
  async reconcileStalePayments(): Promise<ReconcileSummary | null> {
    if (!this.env.PAYMENTS_RECONCILE_ENABLED || process.env.FINANCE_SCHEDULER_DISABLED === '1') {
      this.logger.debug('Payment reconcile skipped (disabled)');
      return null;
    }
    if (this.running) {
      this.logger.debug('Payment reconcile skipped (previous run still in progress)');
      return null;
    }
    this.running = true;
    try {
      return await this.payments.reconcileStale({
        staleAfterMinutes: this.env.PAYMENTS_RECONCILE_STALE_MINUTES,
        batchSize: this.env.PAYMENTS_RECONCILE_BATCH_SIZE,
      });
    } catch (err) {
      this.logger.warn(`Payment reconcile failed: ${(err as Error)?.message ?? 'unknown error'}`);
      return null;
    } finally {
      this.running = false;
    }
  }
}

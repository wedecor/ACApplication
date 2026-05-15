/**
 * Finance background jobs.
 *
 * One scheduler service owns every cron in the finance domain so we can
 * disable / replay them centrally and report execution status to ops.
 *
 *  • `expireQuotations`    every 30 min  — flips overdue quotations to EXPIRED
 *  • `overdueInvoices`     hourly        — emits InvoiceOverdue events
 *  • `materialiseAmcVisits` every 4 h    — converts upcoming visits to bookings
 *  • `amcRenewalSweep`     daily 08:00   — reminders + renewal invoices
 *  • `amcMissedVisitSweep` daily 09:00   — flags missed visits
 *  • `weeklyPayouts`       Mon 06:00     — closes last week's payouts (auto-create)
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  DomainEventName,
  InvoiceStatus,
  PayoutCycle,
} from '@ac/types';

import { PrismaService } from '../../common/prisma/prisma.service';
import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import { AmcSubscriptionsService } from '../amc/amc-subscriptions.service';
import { PayoutsService } from '../payouts/payouts.service';
import { QuotationsService } from '../quotations/quotations.service';

@Injectable()
export class FinanceSchedulerService {
  private readonly logger = new Logger(FinanceSchedulerService.name);
  private readonly disabled = process.env.FINANCE_SCHEDULER_DISABLED === '1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventBus,
    private readonly amc: AmcSubscriptionsService,
    private readonly quotations: QuotationsService,
    private readonly payouts: PayoutsService,
  ) {}

  private gated(name: string): boolean {
    if (this.disabled) {
      this.logger.debug(`Finance cron ${name} skipped (disabled)`);
      return true;
    }
    return false;
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async expireQuotations(): Promise<void> {
    if (this.gated('expireQuotations')) return;
    try {
      const count = await this.quotations.expireOverdue();
      if (count > 0) this.logger.log(`Expired ${count} quotation(s)`);
    } catch (err) {
      this.logger.warn({ err }, 'expireQuotations failed');
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async overdueInvoices(): Promise<void> {
    if (this.gated('overdueInvoices')) return;
    const today = new Date();
    const overdue = await this.prisma.client.invoice.findMany({
      where: {
        dueDate: { lt: today },
        dueAmountMinor: { gt: 0 },
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] },
      },
      select: {
        id: true,
        tenantId: true,
        customerId: true,
        dueAmountMinor: true,
        dueDate: true,
      },
      take: 500,
    });
    for (const inv of overdue) {
      const daysOverdue = Math.max(
        1,
        Math.floor(((inv.dueDate ?? today).getTime() - today.getTime()) / -86_400_000),
      );
      await this.prisma.client.invoice.update({
        where: { id: inv.id },
        data: { status: InvoiceStatus.OVERDUE },
      });
      this.events.publish(DomainEventName.InvoiceOverdue, {
        invoiceId: inv.id,
        customerId: inv.customerId,
        dueAmountMinor: inv.dueAmountMinor,
        daysOverdue,
      } as never);
    }
    if (overdue.length > 0) this.logger.log(`Marked ${overdue.length} invoice(s) overdue`);
  }

  @Cron('0 */4 * * *') // every 4 hours
  async materialiseAmcVisits(): Promise<void> {
    if (this.gated('materialiseAmcVisits')) return;
    try {
      await this.amc.materialiseImminentVisits();
    } catch (err) {
      this.logger.warn({ err }, 'materialiseAmcVisits failed');
    }
  }

  @Cron('0 8 * * *') // daily at 08:00
  async amcRenewalSweep(): Promise<void> {
    if (this.gated('amcRenewalSweep')) return;
    try {
      const r = await this.amc.runRenewalSweep();
      this.logger.log(
        `AMC renewal sweep: reminders=${r.reminders}, renewal invoices=${r.renewals}`,
      );
    } catch (err) {
      this.logger.warn({ err }, 'amcRenewalSweep failed');
    }
  }

  @Cron('0 9 * * *') // daily at 09:00
  async amcMissedVisitSweep(): Promise<void> {
    if (this.gated('amcMissedVisitSweep')) return;
    try {
      const count = await this.amc.runMissedVisitSweep();
      if (count > 0) this.logger.log(`Flagged ${count} missed AMC visit(s)`);
    } catch (err) {
      this.logger.warn({ err }, 'amcMissedVisitSweep failed');
    }
  }

  /**
   * Auto-close last week's payout cycle every Monday 06:00 for technicians
   * whose rule says WEEKLY. Manual payouts continue to work side-by-side.
   */
  @Cron('0 6 * * 1') // Monday 06:00
  async weeklyPayoutClose(): Promise<void> {
    if (this.gated('weeklyPayoutClose')) return;
    const rules = await this.prisma.client.technicianCommissionRule.findMany({
      where: { payoutCycle: PayoutCycle.WEEKLY },
      include: { technician: { select: { id: true, tenantId: true } } },
    });
    let created = 0;
    for (const rule of rules) {
      try {
        await this.payouts.createPayout(
          {
            userId: 'cron',
            tenantId: rule.technician.tenantId,
          } as Parameters<typeof this.payouts.createPayout>[0],
          { technicianId: rule.technicianId },
        );
        created += 1;
      } catch {
        // No commissions to close — silent.
      }
    }
    if (created > 0) this.logger.log(`Opened ${created} weekly payout(s)`);
  }
}

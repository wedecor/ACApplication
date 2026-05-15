import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../common/prisma/prisma.service';
import { SlaService } from './sla.service';

/**
 * Tenant-aware cron that runs SLA scans every minute. We iterate over
 * active tenants and call `SlaService.scanTenant` per tenant — keeping
 * scans short means we don't lock long-running transactions.
 */
@Injectable()
export class SupportSchedulerService {
  private readonly logger = new Logger(SupportSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sla: SlaService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async runSlaScan(): Promise<void> {
    try {
      const tenants = await this.prisma.client.tenant.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true },
      });
      let warnings = 0;
      let breaches = 0;
      for (const t of tenants) {
        const r = await this.sla.scanTenant(t.id);
        warnings += r.warnings;
        breaches += r.breaches;
      }
      if (warnings + breaches > 0) {
        this.logger.log(
          `SLA scan: ${warnings} warnings, ${breaches} breaches across ${tenants.length} tenants`,
        );
      }
    } catch (err) {
      this.logger.error({ err }, 'SLA scan failed');
    }
  }
}

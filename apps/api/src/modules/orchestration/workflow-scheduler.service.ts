import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EscalationEngineService } from './escalation-engine.service';
import { WorkflowEngineService } from './workflow-engine.service';

@Injectable()
export class WorkflowSchedulerService {
  private readonly logger = new Logger(WorkflowSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly escalations: EscalationEngineService,
    private readonly workflows: WorkflowEngineService,
  ) {}

  /** Recover missed cron schedules and run SLA policy sweeps. */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'workflow.scheduler' })
  async tick(): Promise<void> {
    try {
      await this.runDueSchedules();
      await this.runSlaSweep();
      await this.recoverStuckWorkflows();
    } catch (err) {
      this.logger.error({ err }, 'Workflow scheduler tick failed');
    }
  }

  private async runDueSchedules(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.client.workflowSchedule.findMany({
      where: { isActive: true, deletedAt: null, nextRunAt: { lte: now } },
      take: 50,
    });
    for (const sched of due) {
      if (sched.workflowKey) {
        await this.workflows.startFromEvent(sched.tenantId, sched.workflowKey, {
          id: `schedule:${sched.id}:${now.getTime()}`,
          name: 'schedule.triggered',
          occurredAt: now.toISOString(),
          actorId: null,
          payload: sched.payload as Record<string, unknown>,
        } as never);
      }
      await this.prisma.client.workflowSchedule.update({
        where: { id: sched.id },
        data: { lastRunAt: now, nextRunAt: new Date(now.getTime() + 86_400_000) },
      });
    }
  }

  private async runSlaSweep(): Promise<void> {
    const tenants = await this.prisma.client.tenant.findMany({ select: { id: true } });
    for (const t of tenants) {
      await this.escalations.evaluateSlaPolicies(t.id);
    }
  }

  private async recoverStuckWorkflows(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 60_000);
    const stuck = await this.prisma.client.workflowInstance.findMany({
      where: {
        status: 'RUNNING',
        updatedAt: { lt: cutoff },
        deletedAt: null,
      },
      take: 20,
    });
    for (const row of stuck) {
      if (row.currentStepKey) {
        await this.workflows.resume(row.id, row.tenantId);
      }
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '@ac/types';
import type { Prisma } from '@prisma/client';
import { WorkflowInstanceStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkflowRepository } from './workflow.repository';

export interface EscalateInput {
  tenantId: string;
  instanceId?: string;
  resourceType: string;
  resourceId: string;
  level: number;
  target: 'technician' | 'support' | 'management' | 'dispatch';
  reason: string;
  policyId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class EscalationEngineService {
  private readonly logger = new Logger(EscalationEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: WorkflowRepository,
    private readonly notifications: NotificationsService,
  ) {}

  async escalate(input: EscalateInput): Promise<string> {
    const row = await this.prisma.client.escalationLog.create({
      data: {
        tenantId: input.tenantId,
        policyId: input.policyId,
        instanceId: input.instanceId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        level: input.level,
        target: input.target,
        reason: input.reason.slice(0, 2000),
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    if (input.instanceId) {
      await this.repo.updateInstance(input.instanceId, {
        status: WorkflowInstanceStatus.ESCALATED,
      });
      await this.repo.appendWorkflowEvent(
        input.instanceId,
        'escalated',
        input.reason,
        undefined,
        { level: input.level, target: input.target },
      );
    }

    await this.notifyEscalationTargets(input);
    this.logger.warn({ ...input, escalationId: row.id }, 'Escalation recorded');
    return row.id;
  }

  async evaluateSlaPolicies(tenantId: string): Promise<number> {
    const policies = await this.prisma.client.slaPolicy.findMany({
      where: { tenantId, isActive: true, deletedAt: null },
    });
    let triggered = 0;
    for (const policy of policies) {
      const thresholds = policy.thresholds as {
        checks?: Array<{
          field: string;
          op: string;
          value: unknown;
          level: number;
          target: EscalateInput['target'];
          reason: string;
        }>;
      };
      for (const check of thresholds.checks ?? []) {
        const breached = await this.runPolicyCheck(tenantId, policy.resourceType, check);
        if (breached) {
          await this.escalate({
            tenantId,
            resourceType: policy.resourceType,
            resourceId: breached.resourceId,
            level: check.level,
            target: check.target,
            reason: check.reason,
            policyId: policy.id,
          });
          triggered += 1;
        }
      }
    }
    return triggered;
  }

  private async runPolicyCheck(
    tenantId: string,
    resourceType: string,
    check: { field: string; op: string; value: unknown },
  ): Promise<{ resourceId: string } | null> {
    if (resourceType === 'invoice' && check.field === 'daysOverdue') {
      const cutoff = new Date(Date.now() - Number(check.value) * 86_400_000);
      const invoice = await this.prisma.client.invoice.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          dueDate: { lt: cutoff },
          status: { in: ['SENT', 'PARTIALLY_PAID'] },
        },
        select: { id: true },
      });
      return invoice ? { resourceId: invoice.id } : null;
    }
    if (resourceType === 'booking' && check.field === 'minutesUnassigned') {
      const cutoff = new Date(Date.now() - Number(check.value) * 60_000);
      const booking = await this.prisma.client.booking.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          technicianId: null,
          status: 'PENDING',
          createdAt: { lt: cutoff },
        },
        select: { id: true },
      });
      return booking ? { resourceId: booking.id } : null;
    }
    return null;
  }

  private async notifyEscalationTargets(input: EscalateInput): Promise<void> {
    const template = `escalation.${input.target}`;
    await this.notifications.enqueue(
      input.tenantId,
      {},
      [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      {
        template,
        data: {
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          level: input.level,
          reason: input.reason,
        },
        idempotencyKey: `escalation:${input.resourceType}:${input.resourceId}:${input.level}`,
      },
    );
  }
}

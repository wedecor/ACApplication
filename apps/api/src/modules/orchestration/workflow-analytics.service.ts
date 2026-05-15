import { Injectable } from '@nestjs/common';
import { WorkflowInstanceStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class WorkflowAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(tenantId: string) {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const [byStatus, escalations, avgLatency, stuck] = await Promise.all([
      this.prisma.client.workflowInstance.groupBy({
        by: ['status'],
        where: { tenantId, createdAt: { gte: since }, deletedAt: null },
        _count: true,
      }),
      this.prisma.client.escalationLog.count({
        where: { tenantId, createdAt: { gte: since } },
      }),
      this.prisma.client.workflowStepExecution.aggregate({
        where: {
          instance: { tenantId },
          completedAt: { not: null },
          startedAt: { not: null },
        },
        _avg: { attempt: true },
      }),
      this.prisma.client.workflowInstance.count({
        where: {
          tenantId,
          status: { in: [WorkflowInstanceStatus.RUNNING, WorkflowInstanceStatus.WAITING] },
          updatedAt: { lt: new Date(Date.now() - 30 * 60_000) },
        },
      }),
    ]);

    const total = byStatus.reduce((s, r) => s + r._count, 0);
    const completed = byStatus.find((r) => r.status === WorkflowInstanceStatus.COMPLETED)?._count ?? 0;
    const failed =
      (byStatus.find((r) => r.status === WorkflowInstanceStatus.FAILED)?._count ?? 0) +
      (byStatus.find((r) => r.status === WorkflowInstanceStatus.ESCALATED)?._count ?? 0);

    return {
      periodDays: 7,
      total,
      successRate: total > 0 ? completed / total : 0,
      failureRate: total > 0 ? failed / total : 0,
      escalations,
      stuckWorkflows: stuck,
      avgStepAttempts: avgLatency._avg.attempt ?? 0,
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count })),
    };
  }
}

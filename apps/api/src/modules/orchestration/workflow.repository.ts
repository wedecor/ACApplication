import { Injectable } from '@nestjs/common';
import {
  WorkflowInstanceStatus,
  WorkflowStepExecutionStatus,
  type Prisma,
} from '@prisma/client';
import type { WorkflowDefinitionBody } from '@ac/workflow';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class WorkflowRepository {
  constructor(private readonly prisma: PrismaService) {}

  findDefinition(tenantId: string | null, key: string, version?: number) {
    return this.prisma.client.workflowDefinition.findFirst({
      where: {
        key,
        isActive: true,
        OR: [{ tenantId }, { tenantId: null }],
        ...(version ? { version } : {}),
      },
      orderBy: [{ tenantId: 'desc' }, { version: 'desc' }],
    });
  }

  findDefinitionsByTrigger(triggerEvent: string, tenantId: string) {
    return this.prisma.client.workflowDefinition.findMany({
      where: {
        triggerEvent,
        isActive: true,
        OR: [{ tenantId }, { tenantId: null }],
      },
      orderBy: { priority: 'desc' },
    });
  }

  parseDefinition(raw: Prisma.JsonValue): WorkflowDefinitionBody {
    return raw as unknown as WorkflowDefinitionBody;
  }

  async createInstance(input: {
    tenantId: string;
    definitionId: string;
    definitionKey: string;
    definitionVer: number;
    correlationId: string;
    context: Record<string, unknown>;
    resourceType?: string;
    resourceId?: string;
    idempotencyKey?: string;
    aiSnapshot?: Record<string, unknown>;
  }) {
    try {
      return await this.prisma.client.workflowInstance.create({
        data: {
          tenantId: input.tenantId,
          definitionId: input.definitionId,
          definitionKey: input.definitionKey,
          definitionVer: input.definitionVer,
          correlationId: input.correlationId,
          status: WorkflowInstanceStatus.PENDING,
          context: input.context as Prisma.InputJsonValue,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          idempotencyKey: input.idempotencyKey,
          aiSnapshot: input.aiSnapshot as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2002' &&
        input.idempotencyKey
      ) {
        return this.prisma.client.workflowInstance.findFirst({
          where: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey },
        });
      }
      throw err;
    }
  }

  findInstance(id: string, tenantId?: string) {
    return this.prisma.client.workflowInstance.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(tenantId ? { tenantId } : {}),
      },
      include: { definition: true },
    });
  }

  async updateInstance(
    id: string,
    data: Prisma.WorkflowInstanceUpdateInput,
  ): Promise<void> {
    await this.prisma.client.workflowInstance.update({ where: { id }, data });
  }

  async appendWorkflowEvent(
    instanceId: string,
    eventType: string,
    detail?: string,
    stepKey?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.client.workflowEvent.create({
      data: {
        instanceId,
        stepKey,
        eventType,
        detail,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async upsertStepExecution(input: {
    instanceId: string;
    stepKey: string;
    stepType: string;
    maxAttempts?: number;
    scheduledAt?: Date;
  }) {
    return this.prisma.client.workflowStepExecution.upsert({
      where: { instanceId_stepKey: { instanceId: input.instanceId, stepKey: input.stepKey } },
      create: {
        instanceId: input.instanceId,
        stepKey: input.stepKey,
        stepType: input.stepType,
        maxAttempts: input.maxAttempts ?? 3,
        scheduledAt: input.scheduledAt,
        status: WorkflowStepExecutionStatus.PENDING,
      },
      update: {
        scheduledAt: input.scheduledAt,
      },
    });
  }

  findStepExecution(id: string) {
    return this.prisma.client.workflowStepExecution.findUnique({ where: { id } });
  }

  async claimStep(id: string): Promise<boolean> {
    const r = await this.prisma.client.workflowStepExecution.updateMany({
      where: {
        id,
        status: { in: [WorkflowStepExecutionStatus.PENDING, WorkflowStepExecutionStatus.WAITING] },
      },
      data: {
        status: WorkflowStepExecutionStatus.RUNNING,
        startedAt: new Date(),
        attempt: { increment: 1 },
      },
    });
    return r.count === 1;
  }

  async completeStep(id: string, output?: Record<string, unknown>): Promise<void> {
    await this.prisma.client.workflowStepExecution.update({
      where: { id },
      data: {
        status: WorkflowStepExecutionStatus.COMPLETED,
        completedAt: new Date(),
        output: output as Prisma.InputJsonValue | undefined,
        error: null,
      },
    });
  }

  async failStep(id: string, error: string): Promise<void> {
    await this.prisma.client.workflowStepExecution.update({
      where: { id },
      data: {
        status: WorkflowStepExecutionStatus.FAILED,
        error: error.slice(0, 2000),
      },
    });
  }

  listActiveRules(tenantId: string, triggerEvent: string) {
    return this.prisma.client.automationRule.findMany({
      where: { tenantId, triggerEvent, isActive: true, deletedAt: null },
      orderBy: { priority: 'desc' },
    });
  }

  listInstances(
    tenantId: string,
    opts: { status?: WorkflowInstanceStatus; page: number; pageSize: number },
  ) {
    const where: Prisma.WorkflowInstanceWhereInput = {
      tenantId,
      deletedAt: null,
      ...(opts.status ? { status: opts.status } : {}),
    };
    return Promise.all([
      this.prisma.client.workflowInstance.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
      this.prisma.client.workflowInstance.count({ where }),
    ]);
  }

  listTimeline(instanceId: string) {
    return this.prisma.client.workflowEvent.findMany({
      where: { instanceId },
      orderBy: { createdAt: 'asc' },
    });
  }
}

import { randomUUID } from 'node:crypto';

import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { NotificationRecipient } from '@ac/notifications';
import { NotificationChannel } from '@ac/types';
import type { AnyDomainEvent } from '@ac/types';
import type { Prisma } from '@prisma/client';
import {
  evaluateRuleGroup,
  WorkflowStepType,
  type WorkflowDefinitionBody,
  type WorkflowStepDefinition,
} from '@ac/workflow';
import { WorkflowInstanceStatus as DbWorkflowStatus } from '@prisma/client';
import type { Job } from 'bullmq';
import type { WorkflowStepJobPayload } from '@ac/workflow';

import { NotificationsService } from '../notifications/notifications.service';
import { AiContextService } from './ai-context.service';
import { EscalationEngineService } from './escalation-engine.service';
import { WorkflowQueueService } from './workflow-queue.service';
import { WorkflowRepository } from './workflow.repository';

@Injectable()
export class WorkflowEngineService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    private readonly repo: WorkflowRepository,
    private readonly queue: WorkflowQueueService,
    private readonly notifications: NotificationsService,
    private readonly escalations: EscalationEngineService,
    private readonly ai: AiContextService,
  ) {}

  onModuleInit(): void {
    this.queue.registerStepProcessor((job) => this.executeStepJob(job));
  }

  async startFromEvent(
    tenantId: string,
    workflowKey: string,
    envelope: AnyDomainEvent,
    extraContext: Record<string, unknown> = {},
  ): Promise<string | null> {
    const def = await this.repo.findDefinition(tenantId, workflowKey);
    if (!def) return null;

    const idempotencyKey = `wf:${workflowKey}:${this.resourceKey(envelope)}`;
    const instance = await this.repo.createInstance({
      tenantId,
      definitionId: def.id,
      definitionKey: def.key,
      definitionVer: def.version,
      correlationId: envelope.id,
      context: {
        event: envelope.name,
        payload: envelope.payload,
        ...extraContext,
      },
      resourceType: this.inferResourceType(envelope.name),
      resourceId: this.inferResourceId(envelope.payload as Record<string, unknown>),
      idempotencyKey,
      aiSnapshot: await this.ai.buildSnapshot(envelope),
    });

    if (!instance) return null;
    if (instance.status !== DbWorkflowStatus.PENDING) return instance.id;

    await this.repo.updateInstance(instance.id, {
      status: DbWorkflowStatus.RUNNING,
      startedAt: new Date(),
    });
    await this.repo.appendWorkflowEvent(instance.id, 'started', `Workflow ${workflowKey} started`);

    const body = this.repo.parseDefinition(def.definition);
    const startKey = body.startAt ?? body.steps[0]?.key;
    if (!startKey) {
      await this.completeInstance(instance.id, 'No steps defined');
      return instance.id;
    }

    await this.scheduleStep(instance.id, tenantId, startKey, body, envelope.id);
    return instance.id;
  }

  async startByTrigger(tenantId: string, triggerEvent: string, envelope: AnyDomainEvent): Promise<void> {
    const defs = await this.repo.findDefinitionsByTrigger(triggerEvent, tenantId);
    for (const def of defs) {
      await this.startFromEvent(tenantId, def.key, envelope);
    }
  }

  async pause(instanceId: string, tenantId: string): Promise<void> {
    const row = await this.repo.findInstance(instanceId, tenantId);
    if (!row) return;
    await this.repo.updateInstance(instanceId, {
      status: DbWorkflowStatus.PAUSED,
      pausedAt: new Date(),
    });
    await this.repo.appendWorkflowEvent(instanceId, 'paused');
  }

  async resume(instanceId: string, tenantId: string): Promise<void> {
    const row = await this.repo.findInstance(instanceId, tenantId);
    if (!row || !row.currentStepKey) return;
    const body = this.repo.parseDefinition(row.definition.definition);
    await this.repo.updateInstance(instanceId, {
      status: DbWorkflowStatus.RUNNING,
      pausedAt: null,
    });
    await this.scheduleStep(instanceId, tenantId, row.currentStepKey, body, row.correlationId);
  }

  async cancel(instanceId: string, tenantId: string, reason?: string): Promise<void> {
    const row = await this.repo.findInstance(instanceId, tenantId);
    if (!row) return;
    await this.repo.updateInstance(instanceId, {
      status: DbWorkflowStatus.CANCELLED,
      completedAt: new Date(),
      failureReason: reason,
    });
    await this.repo.appendWorkflowEvent(instanceId, 'cancelled', reason);
  }

  private async executeStepJob(job: Job<WorkflowStepJobPayload>): Promise<void> {
    const { stepExecutionId, instanceId, tenantId, correlationId } = job.data;
    const instance = await this.repo.findInstance(instanceId, tenantId);
    if (!instance || instance.status === DbWorkflowStatus.PAUSED) return;
    if (
      instance.status === DbWorkflowStatus.COMPLETED ||
      instance.status === DbWorkflowStatus.CANCELLED
    ) {
      return;
    }

    const stepExec = await this.repo.findStepExecution(stepExecutionId);
    if (!stepExec) return;

    const claimed = await this.repo.claimStep(stepExecutionId);
    if (!claimed) return;

    const body = this.repo.parseDefinition(instance.definition.definition);
    const stepDef = body.steps.find((s) => s.key === stepExec.stepKey);
    if (!stepDef) {
      await this.repo.failStep(stepExecutionId, 'Step definition missing');
      return;
    }

    const ctx =
      instance.context && typeof instance.context === 'object' && !Array.isArray(instance.context)
        ? (instance.context as Record<string, unknown>)
        : {};

    try {
      const nextKey = await this.runStep(instance, stepDef, ctx, tenantId);
      await this.repo.completeStep(stepExecutionId, { nextKey });
      if (stepDef.type === WorkflowStepType.DELAY) {
        return;
      }
      if (nextKey) {
        await this.scheduleStep(instanceId, tenantId, nextKey, body, correlationId);
      } else if (stepDef.type === WorkflowStepType.COMPLETE) {
        await this.completeInstance(instanceId);
      } else if (stepDef.next) {
        await this.scheduleStep(instanceId, tenantId, stepDef.next, body, correlationId);
      } else {
        await this.completeInstance(instanceId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Step failed';
      this.logger.error({ err, instanceId, stepKey: stepExec.stepKey }, 'Workflow step failed');
      await this.repo.failStep(stepExecutionId, msg);
      if (stepExec.attempt >= stepExec.maxAttempts) {
        await this.repo.updateInstance(instanceId, {
          status: DbWorkflowStatus.FAILED,
          failureReason: msg,
        });
      } else {
        await this.queue.scheduleStep(job.data, 30_000);
      }
    }
  }

  private async runStep(
    instance: NonNullable<Awaited<ReturnType<WorkflowRepository['findInstance']>>>,
    step: WorkflowStepDefinition,
    ctx: Record<string, unknown>,
    tenantId: string,
  ): Promise<string | undefined> {
    await this.repo.updateInstance(instance.id, { currentStepKey: step.key });
    await this.repo.appendWorkflowEvent(instance.id, 'step_started', step.key, step.key);

    switch (step.type) {
      case WorkflowStepType.DELAY: {
        const ms = step.delayMs ?? 60_000;
        const nextKey = step.next;
        if (!nextKey) return undefined;
        await this.repo.updateInstance(instance.id, { status: DbWorkflowStatus.WAITING });
        const nextExec = await this.repo.upsertStepExecution({
          instanceId: instance.id,
          stepKey: nextKey,
          stepType: 'delayed_resume',
          scheduledAt: new Date(Date.now() + ms),
        });
        await this.queue.scheduleStep(
          {
            stepExecutionId: nextExec.id,
            instanceId: instance.id,
            tenantId,
            correlationId: instance.correlationId,
          },
          ms,
        );
        return undefined;
      }
      case WorkflowStepType.CONDITION: {
        const pass = step.when ? evaluateRuleGroup(step.when, ctx) : true;
        return pass ? step.onTrue : step.onFalse;
      }
      case WorkflowStepType.NOTIFY: {
        const recipient = await this.resolveRecipient(step, ctx);
        const channels = (step.channels ?? ['SMS']).map((c) => c as NotificationChannel);
        await this.notifications.enqueue(tenantId, recipient, channels, {
          template: step.template ?? 'workflow.notification',
          data: ctx,
          idempotencyKey: `wf:${instance.id}:${step.key}`,
        });
        return step.next;
      }
      case WorkflowStepType.ESCALATE: {
        await this.escalations.escalate({
          tenantId,
          instanceId: instance.id,
          resourceType: instance.resourceType ?? 'workflow',
          resourceId: instance.resourceId ?? instance.id,
          level: step.escalationLevel ?? 1,
          target: step.escalationTarget ?? 'dispatch',
          reason: step.reason ?? `Workflow step ${step.key}`,
        });
        return step.next;
      }
      case WorkflowStepType.PARALLEL: {
        for (const branchKey of step.branches ?? []) {
          const branch = bodyStep(instance, branchKey);
          if (branch) {
            await this.scheduleStep(
              instance.id,
              tenantId,
              branchKey,
              this.repo.parseDefinition(instance.definition.definition),
              instance.correlationId,
            );
          }
        }
        return step.next;
      }
      case WorkflowStepType.SET_CONTEXT: {
        if (step.set) {
          await this.repo.updateInstance(instance.id, {
            context: { ...ctx, ...step.set } as Prisma.InputJsonValue,
          });
        }
        return step.next;
      }
      case WorkflowStepType.AI_DECISION: {
        const decision = await this.ai.decide(step.aiHook ?? 'default', ctx, instance.aiSnapshot);
        return decision.nextStepKey ?? step.next;
      }
      case WorkflowStepType.COMPLETE:
        return undefined;
      default:
        return step.next;
    }
  }

  private async scheduleStep(
    instanceId: string,
    tenantId: string,
    stepKey: string,
    body: WorkflowDefinitionBody,
    correlationId: string,
  ): Promise<void> {
    const stepDef = body.steps.find((s) => s.key === stepKey);
    if (!stepDef) {
      await this.completeInstance(instanceId, `Unknown step ${stepKey}`);
      return;
    }
    const exec = await this.repo.upsertStepExecution({
      instanceId,
      stepKey,
      stepType: stepDef.type,
      maxAttempts: stepDef.maxAttempts,
    });
    await this.repo.updateInstance(instanceId, { status: DbWorkflowStatus.RUNNING });
    await this.queue.scheduleStep({
      stepExecutionId: exec.id,
      instanceId,
      tenantId,
      correlationId,
    });
  }

  private async completeInstance(instanceId: string, detail?: string): Promise<void> {
    await this.repo.updateInstance(instanceId, {
      status: DbWorkflowStatus.COMPLETED,
      completedAt: new Date(),
    });
    await this.repo.appendWorkflowEvent(instanceId, 'completed', detail);
  }

  private async resolveRecipient(
    step: WorkflowStepDefinition,
    ctx: Record<string, unknown>,
  ): Promise<NotificationRecipient> {
    const payload = (ctx['payload'] ?? {}) as Record<string, unknown>;
    if (step.recipient === 'customer' && payload['customerId']) {
      return { userId: String(payload['customerId']) };
    }
    if (step.recipient === 'technician' && payload['technicianId']) {
      return { userId: String(payload['technicianId']) };
    }
    if (step.recipient === 'custom' && step.customUserIdField) {
      const id = payload[step.customUserIdField];
      if (id != null) return { userId: String(id) };
    }
    return {};
  }

  private resourceKey(envelope: AnyDomainEvent): string {
    return `${envelope.name}:${this.inferResourceId(envelope.payload as Record<string, unknown>)}`;
  }

  private inferResourceType(eventName: string): string {
    return eventName.split('.')[0] ?? 'event';
  }

  private inferResourceId(payload: Record<string, unknown>): string {
    for (const k of ['bookingId', 'invoiceId', 'ticketId', 'subscriptionId', 'customerId']) {
      if (payload[k]) return String(payload[k]);
    }
    return randomUUID();
  }
}

function bodyStep(
  instance: { definition: { definition: unknown } },
  key: string,
): WorkflowStepDefinition | undefined {
  const body = instance.definition.definition as WorkflowDefinitionBody;
  return body.steps.find((s) => s.key === key);
}

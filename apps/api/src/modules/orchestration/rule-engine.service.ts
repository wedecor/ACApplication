import { Injectable, Logger } from '@nestjs/common';
import type { AnyDomainEvent } from '@ac/types';
import {
  evaluateRuleGroup,
  type AutomationRuleAction,
  type AutomationRuleBody,
  type RuleConditionGroup,
} from '@ac/workflow';

import { WorkflowRepository } from './workflow.repository';
import { WorkflowEngineService } from './workflow-engine.service';
import { EscalationEngineService } from './escalation-engine.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationChannel } from '@ac/types';

@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);

  constructor(
    private readonly repo: WorkflowRepository,
    private readonly workflows: WorkflowEngineService,
    private readonly escalations: EscalationEngineService,
    private readonly notifications: NotificationsService,
  ) {}

  async evaluateEvent(tenantId: string, envelope: AnyDomainEvent): Promise<void> {
    const rules = await this.repo.listActiveRules(tenantId, envelope.name);
    const ctx = this.buildContext(envelope);

    for (const rule of rules) {
      const body = {
        conditions: rule.conditions as unknown as RuleConditionGroup,
        actions: rule.actions as unknown as AutomationRuleAction[],
      } satisfies AutomationRuleBody;

      if (!evaluateRuleGroup(body.conditions, ctx)) continue;

      this.logger.log({ ruleId: rule.id, event: envelope.name }, 'Rule matched');
      for (const action of body.actions) {
        await this.executeAction(tenantId, action, envelope, ctx);
      }
    }
  }

  private async executeAction(
    tenantId: string,
    action: AutomationRuleAction,
    envelope: AnyDomainEvent,
    ctx: Record<string, unknown>,
  ): Promise<void> {
    switch (action.type) {
      case 'start_workflow':
        if (action.workflowKey) {
          await this.workflows.startFromEvent(tenantId, action.workflowKey, envelope, ctx);
        }
        break;
      case 'notify':
        await this.notifications.enqueue(
          tenantId,
          {},
          (action.channels ?? ['IN_APP']).map((c) => c as NotificationChannel),
          {
            template: action.template ?? 'automation.generic',
            data: ctx,
            idempotencyKey: `rule:${envelope.id}:${action.template}`,
          },
        );
        break;
      case 'escalate':
        await this.escalations.escalate({
          tenantId,
          resourceType: String(ctx['resourceType'] ?? 'unknown'),
          resourceId: String(ctx['resourceId'] ?? envelope.id),
          level: action.escalationLevel ?? 1,
          target: 'dispatch',
          reason: `Rule triggered on ${envelope.name}`,
        });
        break;
      default:
        break;
    }
  }

  private buildContext(envelope: AnyDomainEvent): Record<string, unknown> {
    const payload = envelope.payload as Record<string, unknown>;
    return {
      event: envelope.name,
      eventId: envelope.id,
      occurredAt: envelope.occurredAt,
      ...payload,
      resourceType: this.inferResourceType(envelope.name),
      resourceId: this.inferResourceId(payload),
    };
  }

  private inferResourceType(eventName: string): string {
    const [domain] = eventName.split('.');
    return domain ?? 'unknown';
  }

  private inferResourceId(payload: Record<string, unknown>): string {
    const keys = [
      'bookingId',
      'invoiceId',
      'customerId',
      'technicianId',
      'ticketId',
      'subscriptionId',
    ];
    for (const k of keys) {
      if (payload[k]) return String(payload[k]);
    }
    return '';
  }
}

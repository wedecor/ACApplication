import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { WorkflowStepType, type WorkflowDefinitionBody } from '@ac/workflow';
import { DomainEventName } from '@ac/types';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

const SYSTEM_WORKFLOWS: Array<{
  key: string;
  name: string;
  triggerEvent: string;
  definition: WorkflowDefinitionBody;
}> = [
  {
    key: 'booking-assignment',
    name: 'Booking assignment SLA',
    triggerEvent: DomainEventName.BookingCreated,
    definition: {
      version: 1,
      startAt: 'wait_assign',
      steps: [
        { key: 'wait_assign', type: WorkflowStepType.DELAY, delayMs: 600_000, next: 'check_assigned' },
        {
          key: 'check_assigned',
          type: WorkflowStepType.CONDITION,
          when: { and: [{ field: 'payload.technicianId', op: 'neq', value: null }] },
          onTrue: 'complete',
          onFalse: 'escalate',
        },
        {
          key: 'escalate',
          type: WorkflowStepType.ESCALATE,
          escalationLevel: 1,
          escalationTarget: 'dispatch',
          reason: 'No technician assigned within 10 minutes',
          next: 'notify_dispatch',
        },
        {
          key: 'notify_dispatch',
          type: WorkflowStepType.NOTIFY,
          template: 'booking.unassigned_escalation',
          channels: ['IN_APP', 'PUSH'],
          recipient: 'dispatch',
          next: 'complete',
        },
        { key: 'complete', type: WorkflowStepType.COMPLETE },
      ],
    },
  },
  {
    key: 'invoice-overdue',
    name: 'Invoice overdue recovery',
    triggerEvent: DomainEventName.InvoiceOverdue,
    definition: {
      version: 1,
      startAt: 'remind',
      steps: [
        {
          key: 'remind',
          type: WorkflowStepType.NOTIFY,
          template: 'invoice.overdue',
          channels: ['SMS', 'WHATSAPP', 'EMAIL'],
          recipient: 'customer',
          next: 'wait_payment',
        },
        { key: 'wait_payment', type: WorkflowStepType.DELAY, delayMs: 172_800_000, next: 'escalate_finance' },
        {
          key: 'escalate_finance',
          type: WorkflowStepType.ESCALATE,
          escalationLevel: 2,
          escalationTarget: 'management',
          reason: 'Invoice unpaid after reminder',
          next: 'complete',
        },
        { key: 'complete', type: WorkflowStepType.COMPLETE },
      ],
    },
  },
  {
    key: 'amc-renewal',
    name: 'AMC renewal campaign',
    triggerEvent: DomainEventName.AmcSubscriptionExpiringSoon,
    definition: {
      version: 1,
      startAt: 'renewal_notify',
      steps: [
        {
          key: 'renewal_notify',
          type: WorkflowStepType.NOTIFY,
          template: 'amc.renewal_reminder',
          channels: ['SMS', 'EMAIL', 'WHATSAPP'],
          recipient: 'customer',
          next: 'complete',
        },
        { key: 'complete', type: WorkflowStepType.COMPLETE },
      ],
    },
  },
  {
    key: 'customer-onboarding',
    name: 'Post-service follow-up',
    triggerEvent: DomainEventName.BookingCompleted,
    definition: {
      version: 1,
      startAt: 'welcome',
      steps: [
        {
          key: 'welcome',
          type: WorkflowStepType.NOTIFY,
          template: 'booking.completed',
          channels: ['WHATSAPP', 'EMAIL'],
          recipient: 'customer',
          next: 'delay_feedback',
        },
        { key: 'delay_feedback', type: WorkflowStepType.DELAY, delayMs: 86_400_000, next: 'feedback' },
        {
          key: 'feedback',
          type: WorkflowStepType.NOTIFY,
          template: 'customer.feedback_request',
          channels: ['SMS', 'PUSH'],
          recipient: 'customer',
          next: 'complete',
        },
        { key: 'complete', type: WorkflowStepType.COMPLETE },
      ],
    },
  },
];

@Injectable()
export class WorkflowSeedService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    for (const wf of SYSTEM_WORKFLOWS) {
      const existing = await this.prisma.client.workflowDefinition.findFirst({
        where: { tenantId: null, key: wf.key, version: 1 },
      });
      const data = {
        name: wf.name,
        triggerEvent: wf.triggerEvent,
        definition: wf.definition as unknown as Prisma.InputJsonValue,
        isActive: true,
        priority: 10,
      };
      if (existing) {
        await this.prisma.client.workflowDefinition.update({ where: { id: existing.id }, data });
      } else {
        await this.prisma.client.workflowDefinition.create({
          data: {
            tenantId: null,
            key: wf.key,
            version: 1,
            ...data,
          },
        });
      }
    }
    this.logger.log(`Seeded ${SYSTEM_WORKFLOWS.length} system workflow definitions`);
  }
}

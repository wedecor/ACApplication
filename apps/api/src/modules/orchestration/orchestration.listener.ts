import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DomainEventName, type AnyDomainEvent } from '@ac/types';

import { EventStoreService } from '../../common/events/event-store.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RuleEngineService } from './rule-engine.service';
import { WorkflowEngineService } from './workflow-engine.service';

const ORCHESTRATED_EVENTS = new Set<string>([
  DomainEventName.BookingCreated,
  DomainEventName.BookingAssigned,
  DomainEventName.BookingCompleted,
  DomainEventName.BookingCancelled,
  DomainEventName.InvoiceOverdue,
  DomainEventName.InvoiceSent,
  DomainEventName.PaymentFailed,
  DomainEventName.PaymentSucceeded,
  DomainEventName.AmcSubscriptionExpiringSoon,
  DomainEventName.TechnicianUnreachable,
  DomainEventName.TicketCreated,
  DomainEventName.TicketSlaBreached,
]);

@Injectable()
export class OrchestrationListener {
  private readonly logger = new Logger(OrchestrationListener.name);

  constructor(
    private readonly workflows: WorkflowEngineService,
    private readonly rules: RuleEngineService,
    private readonly eventStore: EventStoreService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('**', { async: true })
  async onDomainEvent(envelope: AnyDomainEvent): Promise<void> {
    if (!envelope?.name || !envelope.id) return;
    if (!ORCHESTRATED_EVENTS.has(envelope.name)) return;

    const tenantId = await this.resolveTenantId(envelope);
    if (!tenantId) return;

    try {
      await this.workflows.startByTrigger(tenantId, envelope.name, envelope);
      await this.rules.evaluateEvent(tenantId, envelope);
      await this.eventStore.markProcessed(envelope.id);
    } catch (err) {
      this.logger.warn({ err, event: envelope.name, eventId: envelope.id }, 'Orchestration failed');
    }
  }

  private async resolveTenantId(envelope: AnyDomainEvent): Promise<string | null> {
    const payload = envelope.payload as Record<string, unknown>;
    if (payload['tenantId']) return String(payload['tenantId']);

    const bookingId = payload['bookingId'] as string | undefined;
    if (bookingId) {
      const b = await this.prisma.client.booking.findUnique({
        where: { id: bookingId },
        select: { tenantId: true },
      });
      return b?.tenantId ?? null;
    }

    const invoiceId = payload['invoiceId'] as string | undefined;
    if (invoiceId) {
      const inv = await this.prisma.client.invoice.findUnique({
        where: { id: invoiceId },
        select: { tenantId: true },
      });
      return inv?.tenantId ?? null;
    }

    const subscriptionId = payload['subscriptionId'] as string | undefined;
    if (subscriptionId) {
      const sub = await this.prisma.client.aMCSubscription.findUnique({
        where: { id: subscriptionId },
        select: { tenantId: true },
      });
      return sub?.tenantId ?? null;
    }

    const ticketId = payload['ticketId'] as string | undefined;
    if (ticketId) {
      const t = await this.prisma.client.supportTicket.findUnique({
        where: { id: ticketId },
        select: { tenantId: true },
      });
      return t?.tenantId ?? null;
    }

    this.logger.warn(
      { event: envelope.name, eventId: envelope.id },
      'Could not resolve tenant for orchestration — event skipped',
    );
    return null;
  }
}

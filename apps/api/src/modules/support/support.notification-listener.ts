import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import {
  type CallMissedEvent,
  type ConversationMessageReceivedEvent,
  DomainEventName,
  NotificationChannel,
  type TicketAssignedEvent,
  type TicketCreatedEvent,
  type TicketEscalatedEvent,
  type TicketReplySentEvent,
  type TicketSlaBreachWarningEvent,
  type TicketSlaBreachedEvent,
} from '@ac/types';

import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Domain-event listener that fans support events out to the notification
 * queue. Kept in the support module so it can be replaced independently.
 */
@Injectable()
export class SupportNotificationListener {
  private readonly logger = new Logger(SupportNotificationListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(DomainEventName.TicketCreated, { async: true })
  async onTicketCreated(event: TicketCreatedEvent): Promise<void> {
    if (!event.payload.customerId) return;
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: event.payload.customerId },
      select: { tenantId: true, phone: true, email: true, userId: true, fullName: true },
    });
    if (!customer) return;
    await this.safeEnqueue(
      customer.tenantId,
      {
        userId: customer.userId,
        phone: customer.phone,
        email: customer.email ?? undefined,
      },
      [NotificationChannel.EMAIL, NotificationChannel.WHATSAPP],
      'support.ticket.created',
      {
        number: event.payload.number,
        customerName: customer.fullName,
        priority: event.payload.priority,
      },
    );
  }

  @OnEvent(DomainEventName.TicketAssigned, { async: true })
  async onTicketAssigned(event: TicketAssignedEvent): Promise<void> {
    const agent = await this.prisma.client.user.findUnique({
      where: { id: event.payload.assignedAgentId },
      select: { id: true, tenantId: true, email: true, phone: true, firstName: true },
    });
    if (!agent) return;
    await this.safeEnqueue(
      agent.tenantId,
      { userId: agent.id, email: agent.email ?? undefined, phone: agent.phone ?? undefined },
      [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.PUSH],
      'support.ticket.assigned',
      { ticketId: event.payload.ticketId },
    );
  }

  @OnEvent(DomainEventName.TicketEscalated, { async: true })
  async onTicketEscalated(event: TicketEscalatedEvent): Promise<void> {
    this.logger.log(
      `Ticket ${event.payload.ticketId} escalated to level ${event.payload.level}`,
    );
  }

  @OnEvent(DomainEventName.TicketReplySent, { async: true })
  async onTicketReplySent(event: TicketReplySentEvent): Promise<void> {
    const ticket = await this.prisma.client.supportTicket.findUnique({
      where: { id: event.payload.ticketId },
      include: {
        customer: { select: { tenantId: true, userId: true, phone: true, email: true } },
      },
    });
    if (!ticket?.customer) return;
    await this.safeEnqueue(
      ticket.tenantId,
      {
        userId: ticket.customer.userId,
        phone: ticket.customer.phone,
        email: ticket.customer.email ?? undefined,
      },
      [NotificationChannel.IN_APP],
      'support.ticket.reply',
      { ticketId: event.payload.ticketId, channel: event.payload.channel },
    );
  }

  @OnEvent(DomainEventName.TicketSlaBreachWarning, { async: true })
  async onSlaWarning(event: TicketSlaBreachWarningEvent): Promise<void> {
    await this.notifyAssignee(event.payload.ticketId, 'support.sla.warning', {
      ticketId: event.payload.ticketId,
      target: event.payload.target,
      minutesRemaining: event.payload.minutesRemaining,
    });
  }

  @OnEvent(DomainEventName.TicketSlaBreached, { async: true })
  async onSlaBreached(event: TicketSlaBreachedEvent): Promise<void> {
    await this.notifyAssignee(event.payload.ticketId, 'support.sla.breach', {
      ticketId: event.payload.ticketId,
      target: event.payload.target,
      minutesOverdue: event.payload.minutesOverdue,
    });
  }

  @OnEvent(DomainEventName.ConversationMessageReceived, { async: true })
  async onInboundMessage(event: ConversationMessageReceivedEvent): Promise<void> {
    if (!event.payload.ticketId) return;
    const ticket = await this.prisma.client.supportTicket.findUnique({
      where: { id: event.payload.ticketId },
      select: { tenantId: true, assignedAgentId: true },
    });
    if (!ticket?.assignedAgentId) return;
    const agent = await this.prisma.client.user.findUnique({
      where: { id: ticket.assignedAgentId },
      select: { id: true, email: true },
    });
    if (!agent) return;
    await this.safeEnqueue(
      ticket.tenantId,
      { userId: agent.id, email: agent.email ?? undefined },
      [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      'support.message.received',
      { ticketId: event.payload.ticketId, preview: event.payload.preview },
    );
  }

  @OnEvent(DomainEventName.CallMissed, { async: true })
  async onCallMissed(event: CallMissedEvent): Promise<void> {
    this.logger.log(
      `Missed call ${event.payload.callLogId} from ${event.payload.fromNumber} (queue=${event.payload.queue ?? '-'})`,
    );
  }

  private async notifyAssignee(
    ticketId: string,
    template: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const ticket = await this.prisma.client.supportTicket.findUnique({
      where: { id: ticketId },
      select: { tenantId: true, assignedAgentId: true },
    });
    if (!ticket?.assignedAgentId) return;
    const agent = await this.prisma.client.user.findUnique({
      where: { id: ticket.assignedAgentId },
      select: { id: true, email: true, phone: true },
    });
    if (!agent) return;
    await this.safeEnqueue(
      ticket.tenantId,
      { userId: agent.id, email: agent.email ?? undefined, phone: agent.phone ?? undefined },
      [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL],
      template,
      data,
    );
  }

  private async safeEnqueue(
    tenantId: string,
    recipient: { userId?: string; email?: string; phone?: string },
    channels: NotificationChannel[],
    template: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.notifications.enqueue(tenantId, recipient, channels, { template, data });
    } catch (err) {
      this.logger.warn({ err, template }, 'Support notification enqueue failed');
    }
  }
}

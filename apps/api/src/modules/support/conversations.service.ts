import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  ConversationChannel,
  ConversationStatus,
  DomainEventName,
  MessageDirection,
  MessageStatus,
  NotificationChannel,
  TicketAuthorKind,
  type UserId,
} from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildPreview, buildThreadKey } from '../../common/support/channels';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  AssignConversationDto,
  ListConversationsDto,
  ListMessagesDto,
  MarkReadDto,
  SendConversationMessageDto,
  TypingIndicatorDto,
} from './dto/conversation.dto';

/**
 * Inbound message envelope produced by per-channel adapters (WhatsApp,
 * email, SMS, web chat). The service is intentionally adapter-agnostic —
 * each adapter normalises into this shape before calling `ingestInbound`.
 */
export interface InboundMessageEnvelope {
  tenantId: string;
  channel: ConversationChannel;
  /** Stable identifier of the remote thread (phone, email, session). */
  threadIdentifier: string;
  externalMessageId?: string;
  body: string;
  /** Used to upsert a Customer row when phone-number matches an existing one. */
  customerLookupPhone?: string;
  customerLookupEmail?: string;
  /** Display name to show on anonymous web-chat threads. */
  fromName?: string;
  /** Raw payload to persist for audit + replay. */
  rawPayload?: Record<string, unknown>;
  /** Provider-reported timestamp; falls back to "now". */
  occurredAt?: Date;
  /** Optional ticket id when the adapter already knows which ticket to attach to. */
  ticketId?: string;
}

export interface IngestInboundResult {
  conversationId: string;
  messageId: string;
  ticketId: string | null;
  isNewConversation: boolean;
}

export interface OutboundReplyInput {
  ticketId: string;
  conversationId?: string;
  channel: ConversationChannel;
  body: string;
  templateName?: string;
  templateData?: Record<string, unknown>;
}

export interface OutboundReplyResult {
  conversationId: string;
  messageId: string;
  status: MessageStatus;
}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventBus,
    private readonly notifications: NotificationsService,
  ) {}

  // ------------------------------------------------------------------ inbox

  async list(
    actor: AuthPrincipal,
    dto: ListConversationsDto,
  ): Promise<{ items: unknown[]; page: number; pageSize: number; total: number }> {
    const where: Prisma.ConversationWhereInput = {
      tenantId: actor.tenantId,
      deletedAt: null,
    };
    if (dto.channel?.length) where.channel = { in: dto.channel };
    if (dto.status?.length) where.status = { in: dto.status };
    if (dto.assignedAgentId) where.assignedAgentId = dto.assignedAgentId;
    if (dto.customerId) where.customerId = dto.customerId;
    if (dto.ticketId) where.ticketId = dto.ticketId;
    if (dto.unread === 'true') where.unreadAgentCount = { gt: 0 };
    if (dto.search) {
      where.OR = [
        { subject: { contains: dto.search, mode: 'insensitive' } },
        { externalThreadKey: { contains: dto.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.conversation.findMany({
        where,
        orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
        skip: dto.skip,
        take: dto.pageSize,
        include: {
          customer: { select: { id: true, fullName: true, phone: true, email: true } },
          assignedAgent: { select: { id: true, firstName: true, lastName: true } },
          ticket: { select: { id: true, number: true, status: true, priority: true } },
        },
      }),
      this.prisma.client.conversation.count({ where }),
    ]);
    return { items, page: dto.page, pageSize: dto.pageSize, total };
  }

  async get(actor: AuthPrincipal, id: string): Promise<unknown> {
    const conv = await this.prisma.client.conversation.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
      include: {
        customer: true,
        assignedAgent: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        ticket: true,
        participants: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  async listMessages(
    actor: AuthPrincipal,
    conversationId: string,
    dto: ListMessagesDto,
  ): Promise<{ items: unknown[]; nextCursor: string | null }> {
    await this.requireConversation(actor.tenantId, conversationId);
    const limit = Math.min(200, dto.limit ?? 50);
    const where: Prisma.ConversationMessageWhereInput = {
      conversationId,
      deletedAt: null,
    };
    if (dto.direction) where.direction = dto.direction;
    const rows = await this.prisma.client.conversationMessage.findMany({
      where: dto.cursor
        ? { ...where, createdAt: { lt: new Date(dto.cursor) } }
        : where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        author: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, -1) : rows).reverse();
    const nextCursor = hasMore ? rows[rows.length - 1]!.createdAt.toISOString() : null;
    return { items, nextCursor };
  }

  async assign(
    actor: AuthPrincipal,
    conversationId: string,
    dto: AssignConversationDto,
  ): Promise<void> {
    const conv = await this.requireConversation(actor.tenantId, conversationId);
    if (conv.assignedAgentId === dto.assignedAgentId) return;
    await this.prisma.client.conversation.update({
      where: { id: conversationId },
      data: { assignedAgentId: dto.assignedAgentId },
    });
    this.events.publish(DomainEventName.ConversationAssigned, {
      conversationId,
      assignedAgentId: dto.assignedAgentId as UserId,
    });
  }

  async changeStatus(
    actor: AuthPrincipal,
    conversationId: string,
    to: ConversationStatus,
  ): Promise<void> {
    const conv = await this.requireConversation(actor.tenantId, conversationId);
    if (conv.status === to) return;
    await this.prisma.client.conversation.update({
      where: { id: conversationId },
      data: { status: to },
    });
    this.events.publish(DomainEventName.ConversationStatusChanged, {
      conversationId,
      from: conv.status,
      to,
    });
  }

  async markRead(
    actor: AuthPrincipal,
    conversationId: string,
    _dto: MarkReadDto,
  ): Promise<void> {
    await this.requireConversation(actor.tenantId, conversationId);
    const now = new Date();
    await this.prisma.client.$transaction([
      this.prisma.client.conversation.update({
        where: { id: conversationId },
        data: { unreadAgentCount: 0 },
      }),
      this.prisma.client.conversationParticipant.updateMany({
        where: { conversationId, userId: actor.userId },
        data: { lastReadAt: now },
      }),
    ]);
    this.events.publish(DomainEventName.ConversationReadReceipt, {
      conversationId,
      readerKind: TicketAuthorKind.AGENT,
      readerUserId: actor.userId as UserId,
      lastReadAt: now.toISOString(),
    });
  }

  async typing(
    actor: AuthPrincipal,
    conversationId: string,
    dto: TypingIndicatorDto,
  ): Promise<void> {
    await this.requireConversation(actor.tenantId, conversationId);
    // Ephemeral — fire-and-forget over the realtime bus.
    this.events.publish(DomainEventName.ConversationTyping, {
      conversationId,
      userId: actor.userId as UserId,
      isTyping: dto.isTyping,
    });
  }

  // ------------------------------------------------------------ ingestion

  /**
   * Idempotent inbound-message ingest. Per-channel adapters call this
   * after they've validated + normalised their payload.
   *
   * Behaviour:
   *   1. Resolve a Customer row by phone / email when possible.
   *   2. Find or create the Conversation keyed on `(channel, threadKey)`.
   *   3. Find or create the SupportTicket for that Conversation — every
   *      inbound message lives on a ticket so SLA timers run.
   *   4. Persist a `ConversationMessage` row.
   *   5. Bump unread counters + last-message timestamps.
   *   6. Mirror to `TicketMessage` for the unified ticket UI.
   */
  async ingestInbound(envelope: InboundMessageEnvelope): Promise<IngestInboundResult> {
    const tenantId = envelope.tenantId;
    const threadKey = buildThreadKey(envelope.channel, envelope.threadIdentifier);
    const occurredAt = envelope.occurredAt ?? new Date();

    // Idempotency on (tenant, channel, externalMessageId).
    if (envelope.externalMessageId) {
      const dup = await this.prisma.client.conversationMessage.findFirst({
        where: {
          tenantId,
          channel: envelope.channel,
          externalMessageId: envelope.externalMessageId,
        },
        select: { id: true, conversationId: true },
      });
      if (dup) {
        const conv = await this.prisma.client.conversation.findFirst({
          where: { id: dup.conversationId },
          select: { ticketId: true },
        });
        return {
          conversationId: dup.conversationId,
          messageId: dup.id,
          ticketId: conv?.ticketId ?? null,
          isNewConversation: false,
        };
      }
    }

    const customer = await this.resolveCustomer(
      tenantId,
      envelope.customerLookupPhone,
      envelope.customerLookupEmail,
    );

    const result = await this.prisma.client.$transaction(async (tx) => {
      // Lazy-create the Conversation.
      let conversation = await tx.conversation.findFirst({
        where: {
          tenantId,
          channel: envelope.channel,
          externalThreadKey: threadKey,
          deletedAt: null,
        },
      });
      let isNewConversation = false;
      if (!conversation) {
        isNewConversation = true;
        conversation = await tx.conversation.create({
          data: {
            tenantId,
            channel: envelope.channel,
            externalThreadKey: threadKey,
            customerId: customer?.id ?? null,
            subject: envelope.body.slice(0, 120),
            status: ConversationStatus.OPEN,
            lastMessageAt: occurredAt,
            lastInboundAt: occurredAt,
            unreadAgentCount: 1,
            metadata: { firstThreadKey: threadKey },
          },
        });
        await tx.conversationParticipant.create({
          data: {
            tenantId,
            conversationId: conversation.id,
            kind: TicketAuthorKind.CUSTOMER,
            userId: customer?.userId ?? null,
            displayName: customer?.fullName ?? envelope.fromName ?? null,
          },
        });
      } else {
        await tx.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: occurredAt,
            lastInboundAt: occurredAt,
            unreadAgentCount: { increment: 1 },
            customerId: conversation.customerId ?? customer?.id ?? null,
            status:
              conversation.status === ConversationStatus.CLOSED
                ? ConversationStatus.OPEN
                : conversation.status,
          },
        });
      }

      // Lazy-create the SupportTicket if the conversation doesn't have one
      // (and the inbound message isn't an existing thread reply).
      let ticketId = conversation.ticketId ?? envelope.ticketId ?? null;
      if (!ticketId) {
        const number = await this.allocateTicketNumber(tenantId, tx);
        const subject = envelope.body.split('\n')[0]?.slice(0, 120) || 'New conversation';
        const ticket = await tx.supportTicket.create({
          data: {
            tenantId,
            number,
            subject,
            description: envelope.body.slice(0, 4000),
            customerId: customer?.id ?? null,
            anonymousIdentifier: customer ? null : envelope.threadIdentifier,
            source: this.channelToSource(envelope.channel),
            status: 'OPEN',
            priority: 'NORMAL',
            metadata: { autoCreatedFromConversation: conversation.id },
          },
          select: { id: true, number: true, customerId: true, priority: true },
        });
        ticketId = ticket.id;
        await tx.conversation.update({
          where: { id: conversation.id },
          data: { ticketId },
        });
        await tx.ticketActivity.create({
          data: {
            tenantId,
            ticketId,
            type: 'CREATED',
            message: `Ticket ${ticket.number} auto-created from inbound ${envelope.channel} message`,
            metadata: {
              channel: envelope.channel,
              conversationId: conversation.id,
            },
          },
        });
      }

      // Persist the message itself.
      const message = await tx.conversationMessage.create({
        data: {
          tenantId,
          conversationId: conversation.id,
          direction: MessageDirection.INBOUND,
          authorKind: TicketAuthorKind.CUSTOMER,
          channel: envelope.channel,
          externalMessageId: envelope.externalMessageId,
          body: envelope.body,
          status: MessageStatus.DELIVERED,
          payload: (envelope.rawPayload ?? {}) as Prisma.InputJsonValue,
          sentAt: occurredAt,
          deliveredAt: occurredAt,
        },
        select: { id: true },
      });

      // Mirror to TicketMessage for the unified UI feed.
      await tx.ticketMessage.create({
        data: {
          tenantId,
          ticketId,
          authorKind: TicketAuthorKind.CUSTOMER,
          body: envelope.body,
          isInternal: false,
          channel: envelope.channel,
          conversationMessageId: message.id,
        },
      });

      // Customer replied → if ticket was WAITING_CUSTOMER, flip it back.
      await tx.supportTicket.updateMany({
        where: { id: ticketId, status: 'WAITING_CUSTOMER' },
        data: { status: 'OPEN' },
      });

      return {
        conversationId: conversation.id,
        messageId: message.id,
        ticketId,
        isNewConversation,
      };
    });

    // Fan-out events (post-commit).
    if (result.isNewConversation) {
      this.events.publish(DomainEventName.ConversationCreated, {
        conversationId: result.conversationId,
        ticketId: result.ticketId,
        channel: envelope.channel,
        customerId: (customer?.id ?? null) as never,
      });
      if (result.ticketId) {
        this.events.publish(DomainEventName.TicketCreated, {
          ticketId: result.ticketId,
          number: '', // best-effort; the listener can re-fetch if needed
          customerId: (customer?.id ?? null) as never,
          source: this.channelToSource(envelope.channel),
          priority: 'NORMAL' as never,
          assignedAgentId: null as never,
        });
      }
    }
    this.events.publish(DomainEventName.ConversationMessageReceived, {
      conversationId: result.conversationId,
      messageId: result.messageId,
      ticketId: result.ticketId,
      channel: envelope.channel,
      direction: MessageDirection.INBOUND,
      preview: buildPreview(envelope.body),
    });
    return result;
  }

  // -------------------------------------------------------------- outbound

  /**
   * Send a reply on a conversation. Persists the ConversationMessage,
   * dispatches the underlying transport (WhatsApp / SMS / email / push
   * for in-app chat) via the NotificationsService dispatcher, and emits
   * the appropriate domain events.
   *
   * The transport call is deliberately non-blocking from the caller's POV:
   * we mark the row as QUEUED then update it as SENT/FAILED based on the
   * provider response, but we never throw if the transport fails — the
   * agent UI shows the "Failed" pill and offers retry.
   */
  async sendOutbound(actor: AuthPrincipal, input: OutboundReplyInput): Promise<OutboundReplyResult> {
    const conversation = input.conversationId
      ? await this.requireConversation(actor.tenantId, input.conversationId)
      : await this.findOrOpenForTicket(actor.tenantId, input.ticketId, input.channel);

    const now = new Date();
    const message = await this.prisma.client.$transaction(async (tx) => {
      const msg = await tx.conversationMessage.create({
        data: {
          tenantId: actor.tenantId,
          conversationId: conversation.id,
          direction: MessageDirection.OUTBOUND,
          authorKind: TicketAuthorKind.AGENT,
          authorUserId: actor.userId,
          channel: input.channel,
          body: input.body,
          templateName: input.templateName,
          status: MessageStatus.QUEUED,
          payload: (input.templateData ?? {}) as Prisma.InputJsonValue,
          sentAt: now,
        },
        select: { id: true },
      });
      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: now,
          lastOutboundAt: now,
        },
      });
      return msg;
    });

    // Push through the notifications dispatcher. We treat the conversation
    // channel as our `NotificationChannel`. WhatsApp + SMS + Email + PUSH
    // (for IN_APP_CHAT) are handled the same way; WEB_CHAT is dispatcher-
    // less — the live-chat gateway will pick the message up over the
    // ConversationMessageSent event and broadcast.
    const notifChannel = this.channelToNotificationChannel(input.channel);
    let status: MessageStatus = MessageStatus.QUEUED;
    if (notifChannel && conversation.customerId) {
      const customer = await this.prisma.client.customer.findFirst({
        where: { id: conversation.customerId, tenantId: actor.tenantId, deletedAt: null },
        select: { phone: true, email: true, userId: true },
      });
      const recipient = customer
        ? {
            userId: customer.userId,
            phone: customer.phone,
            email: customer.email ?? undefined,
          }
        : undefined;
      if (recipient) {
        try {
          const ids = await this.notifications.enqueue(
            actor.tenantId,
            recipient,
            [notifChannel],
            {
              template: input.templateName ?? 'support.reply',
              data: { body: input.body, ...(input.templateData ?? {}) },
              idempotencyKey: `support-reply:${message.id}`,
            },
          );
          if (ids[0]) {
            await this.notifications.processNotification(ids[0]);
            const row = await this.prisma.client.notification.findUnique({
              where: { id: ids[0] },
              select: { status: true, failureReason: true, providerRef: true },
            });
            if (row?.status === 'SENT') status = MessageStatus.SENT;
            if (row?.status === 'FAILED') status = MessageStatus.FAILED;
            await this.prisma.client.conversationMessage.update({
              where: { id: message.id },
              data: {
                status,
                failureReason: row?.failureReason ?? null,
                ...(row?.providerRef ? { externalMessageId: row.providerRef } : {}),
              },
            });
          }
        } catch (err) {
          status = MessageStatus.FAILED;
          await this.prisma.client.conversationMessage.update({
            where: { id: message.id },
            data: { status: MessageStatus.FAILED, failureReason: (err as Error).message },
          });
        }
      }
    }

    this.events.publish(DomainEventName.ConversationMessageSent, {
      conversationId: conversation.id,
      messageId: message.id,
      ticketId: conversation.ticketId,
      channel: input.channel,
      authorUserId: actor.userId as UserId,
    });
    if (status !== MessageStatus.QUEUED) {
      this.events.publish(DomainEventName.ConversationMessageStatusUpdated, {
        conversationId: conversation.id,
        messageId: message.id,
        status,
      });
    }

    return { conversationId: conversation.id, messageId: message.id, status };
  }

  /**
   * Provider-side delivery / read receipts come back asynchronously.
   * Adapters call this to update an existing ConversationMessage row.
   */
  async updateMessageStatus(
    tenantId: string,
    externalMessageId: string,
    channel: ConversationChannel,
    status: MessageStatus,
    timestamp?: Date,
  ): Promise<void> {
    const msg = await this.prisma.client.conversationMessage.findFirst({
      where: { tenantId, channel, externalMessageId },
      select: { id: true, conversationId: true, status: true },
    });
    if (!msg) return;
    if (msg.status === status) return;
    const data: Prisma.ConversationMessageUpdateInput = { status };
    if (status === MessageStatus.SENT) data.sentAt = timestamp ?? new Date();
    if (status === MessageStatus.DELIVERED) data.deliveredAt = timestamp ?? new Date();
    if (status === MessageStatus.READ) data.readAt = timestamp ?? new Date();
    await this.prisma.client.conversationMessage.update({ where: { id: msg.id }, data });
    this.events.publish(DomainEventName.ConversationMessageStatusUpdated, {
      conversationId: msg.conversationId,
      messageId: msg.id,
      status,
    });
  }

  // ----------------------------------------------------------- ticket integration

  /**
   * Open a Conversation as part of a ticket's create flow. Called by the
   * Tickets service when the source maps to a channel.
   */
  async openForTicket(
    actor: AuthPrincipal,
    ticketId: string,
    args: {
      channel: ConversationChannel;
      customerId?: string;
      anonymousIdentifier?: string;
      subject?: string;
    },
  ): Promise<{ id: string }> {
    const customerPhone = args.customerId
      ? await this.prisma.client.customer.findFirst({
          where: { id: args.customerId, tenantId: actor.tenantId },
          select: { phone: true, email: true },
        })
      : null;
    const threadIdentifier =
      args.channel === ConversationChannel.EMAIL
        ? customerPhone?.email ?? args.anonymousIdentifier ?? `ticket:${ticketId}`
        : customerPhone?.phone ?? args.anonymousIdentifier ?? `ticket:${ticketId}`;
    const threadKey = buildThreadKey(args.channel, threadIdentifier);
    const conv = await this.prisma.client.conversation.upsert({
      where: {
        tenantId_channel_externalThreadKey: {
          tenantId: actor.tenantId,
          channel: args.channel,
          externalThreadKey: threadKey,
        },
      },
      update: { ticketId },
      create: {
        tenantId: actor.tenantId,
        channel: args.channel,
        externalThreadKey: threadKey,
        ticketId,
        customerId: args.customerId,
        anonymousIdentifier: args.anonymousIdentifier,
        subject: args.subject,
        status: ConversationStatus.OPEN,
      },
      select: { id: true },
    });
    this.events.publish(DomainEventName.ConversationCreated, {
      conversationId: conv.id,
      ticketId,
      channel: args.channel,
      customerId: (args.customerId ?? null) as never,
    });
    return conv;
  }

  async findOrOpenForTicket(
    tenantId: string,
    ticketId: string,
    channel: ConversationChannel,
  ): Promise<{ id: string; ticketId: string | null; customerId: string | null }> {
    const existing = await this.prisma.client.conversation.findFirst({
      where: { tenantId, ticketId, channel, deletedAt: null },
      select: { id: true, ticketId: true, customerId: true },
      orderBy: { lastMessageAt: 'desc' },
    });
    if (existing) return existing;
    // Create a new one rooted at the ticket's customer.
    const ticket = await this.prisma.client.supportTicket.findFirst({
      where: { id: ticketId, tenantId, deletedAt: null },
      select: { customerId: true, anonymousIdentifier: true, subject: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const customer = ticket.customerId
      ? await this.prisma.client.customer.findFirst({
          where: { id: ticket.customerId, tenantId },
          select: { phone: true, email: true },
        })
      : null;
    const identifier =
      channel === ConversationChannel.EMAIL
        ? customer?.email ?? ticket.anonymousIdentifier ?? `ticket:${ticketId}`
        : customer?.phone ?? ticket.anonymousIdentifier ?? `ticket:${ticketId}`;
    const threadKey = buildThreadKey(channel, identifier);
    const conv = await this.prisma.client.conversation.create({
      data: {
        tenantId,
        channel,
        externalThreadKey: threadKey,
        ticketId,
        customerId: ticket.customerId,
        anonymousIdentifier: ticket.anonymousIdentifier,
        subject: ticket.subject,
      },
      select: { id: true, ticketId: true, customerId: true },
    });
    return conv;
  }

  // -------------------------------------------------------------- helpers

  private async requireConversation(
    tenantId: string,
    id: string,
  ): Promise<{
    id: string;
    tenantId: string;
    channel: ConversationChannel;
    status: ConversationStatus;
    customerId: string | null;
    ticketId: string | null;
    assignedAgentId: string | null;
  }> {
    const conv = await this.prisma.client.conversation.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: {
        id: true,
        tenantId: true,
        channel: true,
        status: true,
        customerId: true,
        ticketId: true,
        assignedAgentId: true,
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  private async resolveCustomer(
    tenantId: string,
    phone?: string,
    email?: string,
  ): Promise<{ id: string; userId: string; fullName: string } | null> {
    if (!phone && !email) return null;
    const customer = await this.prisma.client.customer.findFirst({
      where: {
        tenantId,
        OR: [
          phone ? { phone } : undefined,
          email ? { email } : undefined,
        ].filter(Boolean) as Prisma.CustomerWhereInput[],
        deletedAt: null,
      },
      select: { id: true, userId: true, fullName: true },
    });
    return customer ?? null;
  }

  private async allocateTicketNumber(
    tenantId: string,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    // Inline numbering using an advisory lock — mirrors `nextSupportNumber`
    // but stays inside the existing transaction for atomicity.
    const year = new Date().getUTCFullYear();
    const prefix = `TKT-${year}-`;
    const ADVISORY_NAMESPACE = 0x53_55_50_50;
    const lockKey = stableHash(`${tenantId}:TKT:${year}`);
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(${ADVISORY_NAMESPACE}::bigint, ${lockKey}::bigint)`,
    );
    const latest = await tx.supportTicket.findFirst({
      where: { tenantId, number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    let seq = 1;
    if (latest?.number) {
      const tail = latest.number.slice(prefix.length);
      const parsed = Number.parseInt(tail, 10);
      if (Number.isFinite(parsed)) seq = parsed + 1;
    }
    return `${prefix}${seq.toString().padStart(6, '0')}`;
  }

  private channelToNotificationChannel(
    channel: ConversationChannel,
  ): NotificationChannel | null {
    switch (channel) {
      case ConversationChannel.WHATSAPP:
        return NotificationChannel.WHATSAPP;
      case ConversationChannel.SMS:
        return NotificationChannel.SMS;
      case ConversationChannel.EMAIL:
        return NotificationChannel.EMAIL;
      case ConversationChannel.IN_APP_CHAT:
        return NotificationChannel.PUSH;
      case ConversationChannel.WEB_CHAT:
      case ConversationChannel.PHONE:
      case ConversationChannel.SOCIAL:
      default:
        return null;
    }
  }

  private channelToSource(channel: ConversationChannel): 'WHATSAPP' | 'EMAIL' | 'PHONE' | 'WEB_CHAT' | 'IN_APP_CHAT' | 'SMS' | 'SOCIAL' {
    switch (channel) {
      case ConversationChannel.WHATSAPP:
        return 'WHATSAPP';
      case ConversationChannel.EMAIL:
        return 'EMAIL';
      case ConversationChannel.PHONE:
        return 'PHONE';
      case ConversationChannel.WEB_CHAT:
        return 'WEB_CHAT';
      case ConversationChannel.IN_APP_CHAT:
        return 'IN_APP_CHAT';
      case ConversationChannel.SMS:
        return 'SMS';
      case ConversationChannel.SOCIAL:
        return 'SOCIAL';
    }
  }

  /**
   * Re-route message-status updates from a `SendConversationMessageDto`
   * (used by the conversations controller for direct sends that aren't
   * scoped to a ticket — e.g. proactive outbound by an agent).
   */
  async sendFromConversation(
    actor: AuthPrincipal,
    conversationId: string,
    dto: SendConversationMessageDto,
  ): Promise<OutboundReplyResult> {
    const conv = await this.requireConversation(actor.tenantId, conversationId);
    if (!conv.ticketId) {
      throw new BadRequestException('Conversation has no ticket; create one first');
    }
    return this.sendOutbound(actor, {
      ticketId: conv.ticketId,
      conversationId,
      channel: dto.channel,
      body: dto.body,
      templateName: dto.templateName,
      templateData: dto.templateData,
    });
  }
}

function stableHash(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

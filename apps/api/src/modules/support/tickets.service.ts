import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  ConversationChannel,
  type CustomerId,
  DomainEventName,
  type MessageDirection,
  MessageStatus,
  type SlaTargetKind,
  TicketActivityType,
  TicketAuthorKind,
  TicketPriority,
  TicketSource,
  TicketStatus,
  canTransitionTicket,
  type UserId,
} from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { nextSupportNumber } from '../../common/support/numbering';
import { buildPreview, channelFromSource } from '../../common/support/channels';
import {
  type SlaProfileSnapshot,
  computeDueDates,
  warningWindowMinutes,
} from '../../common/support/sla';
import type {
  AddAttachmentsDto,
  AddNoteDto,
  AssignTicketDto,
  ChangeStatusDto,
  CreateTicketDto,
  CsatDto,
  EscalateTicketDto,
  ListTicketsDto,
  MergeTicketDto,
  ReplyDto,
  UpdateTicketDto,
} from './dto/ticket.dto';
import { ConversationsService } from './conversations.service';

/**
 * Centralised owner of the SupportTicket lifecycle. Other services (SLA
 * scheduler, conversations, calls) call into this service to keep all
 * status transitions + audit activity emission consistent.
 */
@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventBus,
    private readonly conversations: ConversationsService,
  ) {}

  // ------------------------------------------------------------------- CRUD

  async create(
    actor: AuthPrincipal,
    dto: CreateTicketDto,
  ): Promise<{ id: string; number: string }> {
    if (!dto.customerId && !dto.anonymousIdentifier) {
      throw new BadRequestException(
        'Either customerId or anonymousIdentifier is required',
      );
    }
    const tenantId = actor.tenantId;
    const number = await nextSupportNumber(this.prisma, tenantId, {
      prefix: 'TKT',
      table: 'supportTicket',
    });

    const profile = await this.resolveSlaProfile(tenantId, dto.slaProfileId);
    const priority = dto.priority ?? TicketPriority.NORMAL;
    const createdAt = new Date();
    const { firstResponseDueAt, resolutionDueAt } = profile
      ? computeDueDates(createdAt, priority, profile)
      : { firstResponseDueAt: null as Date | null, resolutionDueAt: null as Date | null };

    const ticket = await this.prisma.client.$transaction(async (tx) => {
      const row = await tx.supportTicket.create({
        data: {
          tenantId,
          number,
          customerId: dto.customerId,
          anonymousIdentifier: dto.anonymousIdentifier,
          bookingId: dto.bookingId,
          amcSubscriptionId: dto.amcSubscriptionId,
          subject: dto.subject,
          description: dto.description,
          priority,
          source: dto.source ?? TicketSource.MANUAL,
          category: dto.category,
          subcategory: dto.subcategory,
          tags: dto.tags ?? [],
          assignedAgentId: dto.assignedAgentId,
          assignedTeam: dto.assignedTeam,
          slaProfileId: profile?.id ?? null,
          firstResponseDueAt: firstResponseDueAt ?? undefined,
          resolutionDueAt: resolutionDueAt ?? undefined,
          metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
          createdBy: actor.userId,
          updatedBy: actor.userId,
        },
        select: { id: true, number: true },
      });
      await tx.ticketActivity.create({
        data: {
          tenantId,
          ticketId: row.id,
          type: TicketActivityType.CREATED,
          actorUserId: actor.userId,
          toStatus: TicketStatus.OPEN,
          toPriority: priority,
          message: `Ticket ${row.number} created`,
          metadata: {
            source: dto.source ?? TicketSource.MANUAL,
            category: dto.category ?? null,
          },
        },
      });
      return row;
    });

    // Open a Conversation up-front when the source maps to a channel —
    // every inbound channel becomes a thread, and outbound replies need
    // somewhere to live.
    const channel = channelFromSource(dto.source ?? TicketSource.MANUAL);
    if (channel) {
      await this.conversations.openForTicket(actor, ticket.id, {
        channel,
        customerId: dto.customerId,
        anonymousIdentifier: dto.anonymousIdentifier,
        subject: dto.subject,
      });
    }

    this.events.publish(DomainEventName.TicketCreated, {
      ticketId: ticket.id,
      number: ticket.number,
      customerId: (dto.customerId ?? null) as CustomerId | null,
      source: dto.source ?? TicketSource.MANUAL,
      priority,
      assignedAgentId: (dto.assignedAgentId ?? null) as UserId | null,
    });

    return ticket;
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateTicketDto): Promise<void> {
    const ticket = await this.requireTicket(actor.tenantId, id);
    const data: Prisma.SupportTicketUpdateInput = {
      updatedBy: actor.userId,
    };
    if (dto.subject !== undefined) data.subject = dto.subject;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.subcategory !== undefined) data.subcategory = dto.subcategory;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.metadata !== undefined) data.metadata = dto.metadata as Prisma.InputJsonValue;

    let priorityChanged: { from: TicketPriority; to: TicketPriority } | null = null;
    if (dto.priority && dto.priority !== ticket.priority) {
      priorityChanged = { from: ticket.priority, to: dto.priority };
      data.priority = dto.priority;
    }

    let slaProfileChanged = false;
    if (dto.slaProfileId !== undefined && dto.slaProfileId !== ticket.slaProfileId) {
      slaProfileChanged = true;
      data.slaProfile = dto.slaProfileId
        ? { connect: { id: dto.slaProfileId } }
        : { disconnect: true };
    }

    await this.prisma.client.$transaction(async (tx) => {
      await tx.supportTicket.update({ where: { id }, data });
      if (priorityChanged || slaProfileChanged) {
        // Recompute due dates whenever priority or SLA profile changes.
        const profile = await this.resolveSlaProfile(
          actor.tenantId,
          dto.slaProfileId ?? ticket.slaProfileId ?? undefined,
          tx,
        );
        if (profile) {
          const { firstResponseDueAt, resolutionDueAt } = computeDueDates(
            ticket.createdAt,
            (dto.priority ?? ticket.priority) as TicketPriority,
            profile,
          );
          await tx.supportTicket.update({
            where: { id },
            data: { firstResponseDueAt, resolutionDueAt },
          });
        }
      }
      if (priorityChanged) {
        await tx.ticketActivity.create({
          data: {
            tenantId: actor.tenantId,
            ticketId: id,
            type: TicketActivityType.PRIORITY_CHANGED,
            actorUserId: actor.userId,
            fromPriority: priorityChanged.from,
            toPriority: priorityChanged.to,
            message: `Priority ${priorityChanged.from} → ${priorityChanged.to}`,
          },
        });
      }
      if (dto.tags !== undefined) {
        await tx.ticketActivity.create({
          data: {
            tenantId: actor.tenantId,
            ticketId: id,
            type: TicketActivityType.TAGS_UPDATED,
            actorUserId: actor.userId,
            metadata: { tags: dto.tags },
          },
        });
      }
    });

    if (priorityChanged) {
      this.events.publish(DomainEventName.TicketPriorityChanged, {
        ticketId: id,
        from: priorityChanged.from,
        to: priorityChanged.to,
      });
    }
  }

  async assign(actor: AuthPrincipal, id: string, dto: AssignTicketDto): Promise<void> {
    const ticket = await this.requireTicket(actor.tenantId, id);
    const previousAgentId = ticket.assignedAgentId ?? null;
    if (previousAgentId === dto.assignedAgentId && (!dto.team || dto.team === ticket.assignedTeam)) {
      return;
    }
    await this.prisma.client.$transaction(async (tx) => {
      await tx.supportTicket.update({
        where: { id },
        data: {
          assignedAgentId: dto.assignedAgentId,
          assignedTeam: dto.team ?? ticket.assignedTeam,
          updatedBy: actor.userId,
        },
      });
      await tx.ticketActivity.create({
        data: {
          tenantId: actor.tenantId,
          ticketId: id,
          type: previousAgentId
            ? TicketActivityType.REASSIGNED
            : TicketActivityType.ASSIGNED,
          actorUserId: actor.userId,
          metadata: { fromUserId: previousAgentId, toUserId: dto.assignedAgentId },
        },
      });
    });
    this.events.publish(DomainEventName.TicketAssigned, {
      ticketId: id,
      assignedAgentId: dto.assignedAgentId as UserId,
      previousAgentId: previousAgentId as UserId | null,
    });
  }

  async changeStatus(
    actor: AuthPrincipal,
    id: string,
    dto: ChangeStatusDto,
  ): Promise<void> {
    await this.transitionStatus(actor, id, dto.status, dto.reason, actor.userId);
  }

  async escalate(actor: AuthPrincipal, id: string, dto: EscalateTicketDto): Promise<void> {
    const ticket = await this.requireTicket(actor.tenantId, id);
    const level = dto.level ?? Math.min(5, (ticket.escalationLevel ?? 0) + 1);
    await this.prisma.client.$transaction(async (tx) => {
      await tx.supportTicket.update({
        where: { id },
        data: {
          escalationLevel: level,
          escalatedAt: new Date(),
          status: TicketStatus.ESCALATED,
          ...(dto.assignToUserId ? { assignedAgentId: dto.assignToUserId } : {}),
          updatedBy: actor.userId,
        },
      });
      await tx.ticketActivity.create({
        data: {
          tenantId: actor.tenantId,
          ticketId: id,
          type: TicketActivityType.ESCALATED,
          actorUserId: actor.userId,
          fromStatus: ticket.status,
          toStatus: TicketStatus.ESCALATED,
          message: dto.reason ?? `Escalated to level ${level}`,
          metadata: { level, reason: dto.reason ?? null },
        },
      });
    });
    this.events.publish(DomainEventName.TicketEscalated, {
      ticketId: id,
      level,
      reason: dto.reason ?? null,
    });
    if (ticket.status !== TicketStatus.ESCALATED) {
      this.events.publish(DomainEventName.TicketStatusChanged, {
        ticketId: id,
        from: ticket.status,
        to: TicketStatus.ESCALATED,
      });
    }
  }

  async resolve(actor: AuthPrincipal, id: string, reason?: string): Promise<void> {
    await this.transitionStatus(actor, id, TicketStatus.RESOLVED, reason, actor.userId);
  }

  async close(actor: AuthPrincipal, id: string, reason?: string): Promise<void> {
    await this.transitionStatus(actor, id, TicketStatus.CLOSED, reason, actor.userId);
  }

  async reopen(actor: AuthPrincipal, id: string, reason?: string): Promise<void> {
    await this.transitionStatus(actor, id, TicketStatus.OPEN, reason, actor.userId);
    this.events.publish(DomainEventName.TicketReopened, {
      ticketId: id,
      reopenedBy: actor.userId as UserId,
      reason: reason ?? null,
    });
  }

  async merge(actor: AuthPrincipal, sourceId: string, dto: MergeTicketDto): Promise<void> {
    if (sourceId === dto.targetTicketId) {
      throw new BadRequestException('Cannot merge a ticket into itself');
    }
    const [source, target] = await Promise.all([
      this.requireTicket(actor.tenantId, sourceId),
      this.requireTicket(actor.tenantId, dto.targetTicketId),
    ]);
    if (source.mergedIntoId) {
      throw new BadRequestException('Source ticket is already merged');
    }
    await this.prisma.client.$transaction(async (tx) => {
      await tx.supportTicket.update({
        where: { id: sourceId },
        data: {
          mergedIntoId: target.id,
          status: TicketStatus.CLOSED,
          closedAt: new Date(),
          updatedBy: actor.userId,
        },
      });
      // Re-anchor conversations / calls to the target.
      await tx.conversation.updateMany({
        where: { ticketId: sourceId },
        data: { ticketId: target.id },
      });
      await tx.callLog.updateMany({
        where: { ticketId: sourceId },
        data: { ticketId: target.id },
      });
      await tx.ticketActivity.create({
        data: {
          tenantId: actor.tenantId,
          ticketId: sourceId,
          type: TicketActivityType.MERGED,
          actorUserId: actor.userId,
          metadata: { targetTicketId: target.id, targetNumber: target.number },
        },
      });
      await tx.ticketActivity.create({
        data: {
          tenantId: actor.tenantId,
          ticketId: target.id,
          type: TicketActivityType.MERGED,
          actorUserId: actor.userId,
          metadata: { sourceTicketId: source.id, sourceNumber: source.number },
        },
      });
    });
    this.events.publish(DomainEventName.TicketMerged, {
      sourceTicketId: sourceId,
      targetTicketId: target.id,
    });
  }

  async addNote(
    actor: AuthPrincipal,
    id: string,
    dto: AddNoteDto,
  ): Promise<{ messageId: string }> {
    const ticket = await this.requireTicket(actor.tenantId, id);
    const message = await this.prisma.client.$transaction(async (tx) => {
      const msg = await tx.ticketMessage.create({
        data: {
          tenantId: actor.tenantId,
          ticketId: id,
          authorKind: TicketAuthorKind.AGENT,
          authorUserId: actor.userId,
          body: dto.body,
          isInternal: dto.isInternal ?? true,
        },
        select: { id: true },
      });
      await tx.ticketActivity.create({
        data: {
          tenantId: actor.tenantId,
          ticketId: id,
          type: TicketActivityType.NOTE_ADDED,
          actorUserId: actor.userId,
          message: buildPreview(dto.body),
          metadata: { messageId: msg.id, isInternal: dto.isInternal ?? true },
        },
      });
      return msg;
    });
    this.events.publish(DomainEventName.TicketNoteAdded, {
      ticketId: id,
      messageId: message.id,
      authorKind: TicketAuthorKind.AGENT,
    });
    // Internal notes don't count for first-response. External replies do —
    // handled by recordReply instead.
    void ticket;
    return { messageId: message.id };
  }

  async reply(
    actor: AuthPrincipal,
    id: string,
    dto: ReplyDto,
  ): Promise<{ messageId: string; conversationMessageId: string | null }> {
    const ticket = await this.requireTicket(actor.tenantId, id);
    const channel = dto.channel ?? channelFromSource(ticket.source);
    if (!channel) {
      throw new BadRequestException('Ticket source has no channel — use addNote instead');
    }
    // 1) Send the message through the conversations service (which talks to
    //    the channel-specific transport). It returns the conversation +
    //    persisted ConversationMessage.
    const conversationResult = await this.conversations.sendOutbound(actor, {
      ticketId: id,
      conversationId: dto.conversationId,
      channel,
      body: dto.body,
      templateName: dto.templateName,
      templateData: dto.templateData,
    });

    // 2) Persist the agent-facing TicketMessage that mirrors the reply.
    const message = await this.prisma.client.$transaction(async (tx) => {
      const msg = await tx.ticketMessage.create({
        data: {
          tenantId: actor.tenantId,
          ticketId: id,
          authorKind: TicketAuthorKind.AGENT,
          authorUserId: actor.userId,
          body: dto.body,
          isInternal: false,
          channel,
          conversationMessageId: conversationResult.messageId,
        },
        select: { id: true },
      });
      await tx.ticketActivity.create({
        data: {
          tenantId: actor.tenantId,
          ticketId: id,
          type: TicketActivityType.REPLY_SENT,
          actorUserId: actor.userId,
          message: buildPreview(dto.body),
          metadata: {
            channel,
            conversationMessageId: conversationResult.messageId,
          },
        },
      });
      return msg;
    });

    this.events.publish(DomainEventName.TicketReplySent, {
      ticketId: id,
      messageId: message.id,
      conversationMessageId: conversationResult.messageId ?? null,
      channel,
    });

    // 3) Record first-response if this is the first outbound message.
    await this.recordFirstResponseIfNeeded(actor.tenantId, id);

    return {
      messageId: message.id,
      conversationMessageId: conversationResult.messageId ?? null,
    };
  }

  async addAttachments(
    actor: AuthPrincipal,
    id: string,
    dto: AddAttachmentsDto,
  ): Promise<{ ids: string[] }> {
    await this.requireTicket(actor.tenantId, id);
    if (!dto.attachments?.length) return { ids: [] };
    const ids = await this.prisma.client.$transaction(async (tx) => {
      const out: string[] = [];
      for (const a of dto.attachments) {
        const row = await tx.ticketAttachment.create({
          data: {
            tenantId: actor.tenantId,
            ticketId: id,
            messageId: dto.messageId,
            storageKey: a.storageKey,
            url: a.url,
            fileName: a.fileName,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
            kind: a.kind ?? 'file',
            uploadedBy: actor.userId,
          },
          select: { id: true },
        });
        out.push(row.id);
      }
      await tx.ticketActivity.create({
        data: {
          tenantId: actor.tenantId,
          ticketId: id,
          type: TicketActivityType.ATTACHMENT_ADDED,
          actorUserId: actor.userId,
          metadata: { count: dto.attachments.length },
        },
      });
      return out;
    });
    return { ids };
  }

  async recordCsat(
    actor: AuthPrincipal,
    id: string,
    dto: CsatDto,
  ): Promise<void> {
    const ticket = await this.requireTicket(actor.tenantId, id);
    // Only the customer (or staff acting on behalf) may rate.
    if (
      ticket.customerId &&
      actor.roles.length === 1 &&
      actor.roles.includes('CUSTOMER' as never) &&
      ticket.customerId !== actor.userId
    ) {
      // very defensive check; the upstream guard handles the typical case.
      throw new ForbiddenException('Not allowed to rate this ticket');
    }
    await this.prisma.client.$transaction(async (tx) => {
      await tx.supportTicket.update({
        where: { id },
        data: {
          satisfactionRating: dto.rating,
          csatComment: dto.comment,
        },
      });
      await tx.ticketActivity.create({
        data: {
          tenantId: actor.tenantId,
          ticketId: id,
          type: TicketActivityType.CSAT_RECORDED,
          actorUserId: actor.userId,
          metadata: { rating: dto.rating, comment: dto.comment ?? null },
        },
      });
    });
    this.events.publish(DomainEventName.TicketCsatRecorded, {
      ticketId: id,
      rating: dto.rating,
      comment: dto.comment ?? null,
    });
  }

  // ----------------------------------------------------------- read helpers

  async list(actor: AuthPrincipal, dto: ListTicketsDto): Promise<{
    items: unknown[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    const where: Prisma.SupportTicketWhereInput = {
      tenantId: actor.tenantId,
      deletedAt: null,
    };
    if (dto.status?.length) where.status = { in: dto.status };
    if (dto.priority?.length) where.priority = { in: dto.priority };
    if (dto.source?.length) where.source = { in: dto.source };
    if (dto.assignedAgentId) where.assignedAgentId = dto.assignedAgentId;
    if (dto.assignedTeam) where.assignedTeam = dto.assignedTeam;
    if (dto.customerId) where.customerId = dto.customerId;
    if (dto.bookingId) where.bookingId = dto.bookingId;
    if (dto.tag) where.tags = { has: dto.tag };
    if (dto.search) {
      where.OR = [
        { number: { contains: dto.search, mode: 'insensitive' } },
        { subject: { contains: dto.search, mode: 'insensitive' } },
        { description: { contains: dto.search, mode: 'insensitive' } },
      ];
    }
    if (dto.overdue === 'true') {
      where.OR = [
        ...(where.OR ?? []),
        { resolutionDueAt: { lt: new Date() }, resolvedAt: null },
      ];
    }
    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.supportTicket.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: dto.skip,
        take: dto.pageSize,
        include: {
          customer: { select: { id: true, fullName: true, phone: true, email: true } },
          assignedAgent: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          slaProfile: { select: { id: true, name: true } },
        },
      }),
      this.prisma.client.supportTicket.count({ where }),
    ]);
    return { items, page: dto.page, pageSize: dto.pageSize, total };
  }

  async get(actor: AuthPrincipal, id: string): Promise<unknown> {
    const ticket = await this.prisma.client.supportTicket.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
      include: {
        customer: { select: { id: true, fullName: true, phone: true, email: true } },
        booking: { select: { id: true, code: true, status: true } },
        amcSubscription: { select: { id: true, number: true, status: true } },
        assignedAgent: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        slaProfile: true,
        conversations: {
          select: {
            id: true,
            channel: true,
            status: true,
            lastMessageAt: true,
            unreadAgentCount: true,
          },
        },
        attachments: { take: 50, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async getActivities(actor: AuthPrincipal, id: string): Promise<unknown[]> {
    await this.requireTicket(actor.tenantId, id);
    return this.prisma.client.ticketActivity.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      take: 200,
    });
  }

  async getMessages(actor: AuthPrincipal, id: string): Promise<unknown[]> {
    await this.requireTicket(actor.tenantId, id);
    return this.prisma.client.ticketMessage.findMany({
      where: { ticketId: id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, email: true } },
        attachments: true,
      },
      take: 500,
    });
  }

  // ---------------------------------------------------------------- internals

  async requireTicket(
    tenantId: string,
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{
    id: string;
    tenantId: string;
    number: string;
    status: TicketStatus;
    priority: TicketPriority;
    source: TicketSource;
    assignedAgentId: string | null;
    assignedTeam: string | null;
    slaProfileId: string | null;
    firstResponseRecorded: boolean;
    firstResponseDueAt: Date | null;
    resolutionDueAt: Date | null;
    escalationLevel: number;
    mergedIntoId: string | null;
    customerId: string | null;
    bookingId: string | null;
    createdAt: Date;
  }> {
    const db = tx ?? this.prisma.client;
    const ticket = await db.supportTicket.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: {
        id: true,
        tenantId: true,
        number: true,
        status: true,
        priority: true,
        source: true,
        assignedAgentId: true,
        assignedTeam: true,
        slaProfileId: true,
        firstResponseRecorded: true,
        firstResponseDueAt: true,
        resolutionDueAt: true,
        escalationLevel: true,
        mergedIntoId: true,
        customerId: true,
        bookingId: true,
        createdAt: true,
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  /**
   * Records the first-response timestamp the first time an outbound reply
   * is sent on a ticket. Emits `TicketFirstResponseRecorded` so the SLA
   * analytics + breach scheduler can update their state.
   */
  async recordFirstResponseIfNeeded(
    tenantId: string,
    ticketId: string,
  ): Promise<void> {
    const ticket = await this.prisma.client.supportTicket.findFirst({
      where: { id: ticketId, tenantId, firstResponseRecorded: false, deletedAt: null },
      select: {
        firstResponseDueAt: true,
        createdAt: true,
      },
    });
    if (!ticket) return;
    const now = new Date();
    const deltaSeconds = Math.round((now.getTime() - ticket.createdAt.getTime()) / 1000);
    const metTarget = ticket.firstResponseDueAt
      ? now.getTime() <= ticket.firstResponseDueAt.getTime()
      : true;
    await this.prisma.client.supportTicket.update({
      where: { id: ticketId },
      data: {
        firstResponseRecorded: true,
        firstResponseAt: now,
      },
    });
    this.events.publish(DomainEventName.TicketFirstResponseRecorded, {
      ticketId,
      respondedAt: now.toISOString(),
      deltaSeconds,
      metTarget,
    });
  }

  /**
   * Centralised status transition with validation + activity + event emission.
   * Called by both the public endpoints and by other services (SLA breach
   * → auto-escalate, conversation close → ticket close, etc.).
   */
  async transitionStatus(
    actor: AuthPrincipal,
    id: string,
    to: TicketStatus,
    reason: string | undefined,
    actorUserId: string | undefined,
  ): Promise<void> {
    const ticket = await this.requireTicket(actor.tenantId, id);
    if (ticket.status === to) return;
    if (!canTransitionTicket(ticket.status, to)) {
      throw new BadRequestException(
        `Cannot transition ticket from ${ticket.status} to ${to}`,
      );
    }
    await this.prisma.client.$transaction(async (tx) => {
      const now = new Date();
      const data: Prisma.SupportTicketUpdateInput = {
        status: to,
        updatedBy: actorUserId,
      };
      if (to === TicketStatus.RESOLVED && !ticket.firstResponseRecorded) {
        data.firstResponseAt = now;
        data.firstResponseRecorded = true;
      }
      if (to === TicketStatus.RESOLVED) data.resolvedAt = now;
      if (to === TicketStatus.CLOSED) data.closedAt = now;
      if (to === TicketStatus.OPEN && (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED)) {
        data.reopenedAt = now;
        // Resolved/closed → open clears the resolvedAt timestamp so SLA
        // dashboards count the active hours correctly.
        data.resolvedAt = null;
        data.closedAt = null;
      }
      await tx.supportTicket.update({ where: { id }, data });
      await tx.ticketActivity.create({
        data: {
          tenantId: actor.tenantId,
          ticketId: id,
          type:
            to === TicketStatus.RESOLVED
              ? TicketActivityType.RESOLVED
              : to === TicketStatus.CLOSED
                ? TicketActivityType.CLOSED
                : to === TicketStatus.OPEN && (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED)
                  ? TicketActivityType.REOPENED
                  : TicketActivityType.STATUS_CHANGED,
          actorUserId,
          fromStatus: ticket.status,
          toStatus: to,
          message: reason,
        },
      });
    });
    this.events.publish(DomainEventName.TicketStatusChanged, {
      ticketId: id,
      from: ticket.status,
      to,
    });
    if (to === TicketStatus.RESOLVED) {
      this.events.publish(DomainEventName.TicketResolved, {
        ticketId: id,
        resolvedBy: (actorUserId ?? null) as UserId | null,
      });
    }
    if (to === TicketStatus.CLOSED) {
      this.events.publish(DomainEventName.TicketClosed, {
        ticketId: id,
        closedBy: (actorUserId ?? null) as UserId | null,
      });
    }
  }

  /** Called by `SlaSchedulerService` when a breach-warning fires. */
  async recordSlaWarning(
    tenantId: string,
    ticketId: string,
    target: SlaTargetKind,
    dueAt: Date,
    minutesRemaining: number,
  ): Promise<void> {
    await this.prisma.client.ticketActivity.create({
      data: {
        tenantId,
        ticketId,
        type: TicketActivityType.SLA_BREACH_WARNING,
        metadata: {
          target,
          dueAt: dueAt.toISOString(),
          minutesRemaining,
        },
      },
    });
    this.events.publish(DomainEventName.TicketSlaBreachWarning, {
      ticketId,
      target,
      dueAt: dueAt.toISOString(),
      minutesRemaining,
    });
  }

  /** Called by `SlaSchedulerService` when a breach fires. */
  async recordSlaBreach(
    tenantId: string,
    ticketId: string,
    target: SlaTargetKind,
    dueAt: Date,
    minutesOverdue: number,
  ): Promise<void> {
    await this.prisma.client.ticketActivity.create({
      data: {
        tenantId,
        ticketId,
        type: TicketActivityType.SLA_BREACHED,
        metadata: {
          target,
          dueAt: dueAt.toISOString(),
          minutesOverdue,
        },
      },
    });
    this.events.publish(DomainEventName.TicketSlaBreached, {
      ticketId,
      target,
      dueAt: dueAt.toISOString(),
      minutesOverdue,
    });
  }

  /** Auto-escalates a ticket on SLA breach. Skips if already escalated. */
  async autoEscalateOnBreach(
    tenantId: string,
    ticketId: string,
    reason: string,
  ): Promise<void> {
    const ticket = await this.prisma.client.supportTicket.findFirst({
      where: { id: ticketId, tenantId, deletedAt: null },
      select: { id: true, status: true, priority: true, escalationLevel: true },
    });
    if (!ticket) return;
    if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED) return;
    // bump priority up one tier if not already URGENT
    const priorityOrder: TicketPriority[] = [
      TicketPriority.LOW,
      TicketPriority.NORMAL,
      TicketPriority.HIGH,
      TicketPriority.URGENT,
    ];
    const idx = priorityOrder.indexOf(ticket.priority);
    const nextPriority = idx >= 0 && idx < priorityOrder.length - 1
      ? priorityOrder[idx + 1]
      : ticket.priority;
    const level = Math.min(5, (ticket.escalationLevel ?? 0) + 1);
    await this.prisma.client.$transaction(async (tx) => {
      await tx.supportTicket.update({
        where: { id: ticketId },
        data: {
          escalationLevel: level,
          escalatedAt: new Date(),
          status: TicketStatus.ESCALATED,
          priority: nextPriority,
        },
      });
      await tx.ticketActivity.create({
        data: {
          tenantId,
          ticketId,
          type: TicketActivityType.ESCALATED,
          fromStatus: ticket.status,
          toStatus: TicketStatus.ESCALATED,
          fromPriority: ticket.priority,
          toPriority: nextPriority,
          message: reason,
          metadata: { auto: true, level },
        },
      });
    });
    this.events.publish(DomainEventName.TicketEscalated, {
      ticketId,
      level,
      reason,
    });
  }

  // ---------------------------------------------------------- SLA profile

  /**
   * Resolves the SLA profile to apply to a ticket. Order of preference:
   *   1. Explicit `slaProfileId` argument.
   *   2. Tenant's default profile (`isDefault = true`).
   *   3. Built-in fallback (30min / 480min, 24×7).
   */
  async resolveSlaProfile(
    tenantId: string,
    slaProfileId?: string | null,
    tx?: Prisma.TransactionClient,
  ): Promise<(SlaProfileSnapshot & { id: string }) | null> {
    const db = tx ?? this.prisma.client;
    let profile = slaProfileId
      ? await db.sLAProfile.findFirst({
          where: { id: slaProfileId, tenantId, isActive: true, deletedAt: null },
        })
      : null;
    if (!profile) {
      profile = await db.sLAProfile.findFirst({
        where: { tenantId, isDefault: true, isActive: true, deletedAt: null },
      });
    }
    if (!profile) {
      return {
        id: 'fallback',
        firstResponseMinutes: 30,
        resolutionMinutes: 480,
        businessHoursOnly: false,
        priorityOverrides: {} as SlaProfileSnapshot['priorityOverrides'],
      };
    }
    return {
      id: profile.id,
      firstResponseMinutes: profile.firstResponseMinutes,
      resolutionMinutes: profile.resolutionMinutes,
      businessHoursOnly: profile.businessHoursOnly,
      priorityOverrides:
        (profile.priorityOverrides as SlaProfileSnapshot['priorityOverrides']) ?? {},
    };
  }

  /** Helper for the scheduler — surfaces warning + breach windows. */
  warningMinutes(targetMinutes: number): number {
    return warningWindowMinutes(targetMinutes);
  }

  /** Type-narrow direction for the scheduler. */
  isInbound(direction: MessageDirection): boolean {
    return direction === ('INBOUND' as MessageDirection);
  }

  /** Helper exposed for the message inbound listener — records the customer
   * reply on the ticket as a TicketMessage row for the unified UI feed. */
  async recordInboundMessage(
    tenantId: string,
    ticketId: string,
    conversationMessageId: string,
    body: string,
    channel: ConversationChannel,
  ): Promise<void> {
    await this.prisma.client.ticketMessage.create({
      data: {
        tenantId,
        ticketId,
        authorKind: TicketAuthorKind.CUSTOMER,
        body,
        isInternal: false,
        channel,
        conversationMessageId,
      },
    });
    // After the first inbound or outbound, set first-response on next agent reply.
    // We don't bump the timer here — the message is the customer's, not ours.
    this.logger.debug(`Recorded inbound message on ticket ${ticketId} via ${channel}`);
    // Reset "waiting for customer" state when the customer replies.
    await this.prisma.client.supportTicket.updateMany({
      where: { id: ticketId, status: TicketStatus.WAITING_CUSTOMER },
      data: { status: TicketStatus.OPEN },
    });
    // Increment unreadAgentCount on the conversation handled by ConversationsService.
    // Status is silently nudged — we don't fire an event because the customer
    // message already produces ConversationMessageReceived.
    void MessageStatus.DELIVERED; // keep MessageStatus imported for downstream
  }
}

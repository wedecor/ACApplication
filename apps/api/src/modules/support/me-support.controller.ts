import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Max, Min, MinLength } from 'class-validator';

import {
  ConversationChannel,
  Permission,
  TicketAuthorKind,
  TicketPriority,
  TicketSource,
} from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConversationsService } from './conversations.service';
import { TicketsService } from './tickets.service';

class CreateMyTicketDto {
  @IsString() @MinLength(3) @MaxLength(160)
  subject!: string;

  @IsString() @MinLength(5) @MaxLength(4000)
  message!: string;

  @IsOptional() @IsString()
  bookingId?: string;

  @IsOptional() @IsString()
  amcSubscriptionId?: string;
}

class CustomerMessageDto {
  @IsString() @MinLength(1) @MaxLength(4000)
  body!: string;
}

class CsatRatingDto {
  @IsInt() @Min(1) @Max(5)
  rating!: number;

  @IsOptional() @IsString() @MaxLength(1000)
  comment?: string;
}

/**
 * Customer-facing self-service surface for the support module.
 *
 * Routes:
 *   GET    /api/v1/me/support/tickets                   list my tickets
 *   POST   /api/v1/me/support/tickets                   create a ticket
 *   GET    /api/v1/me/support/tickets/:id               read my ticket
 *   GET    /api/v1/me/support/tickets/:id/messages      thread
 *   POST   /api/v1/me/support/tickets/:id/messages      send a customer message
 *   POST   /api/v1/me/support/tickets/:id/csat          leave a CSAT rating
 *
 * Every route enforces ownership by joining the principal's `customerId`
 * to the ticket row — customers can never read or write another
 * customer's tickets.
 */
@ApiTags('me:support')
@ApiBearerAuth()
@Controller({ path: 'me/support', version: '1' })
export class MeSupportController {
  constructor(
    private readonly tickets: TicketsService,
    private readonly conversations: ConversationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('tickets')
  @RequirePermissions(Permission.TICKET_VIEW)
  @ApiOperation({ summary: 'List support tickets for the current customer.' })
  async list(@CurrentUser() actor: AuthPrincipal) {
    const customerId = await this.requireCustomer(actor);
    const items = await this.prisma.client.supportTicket.findMany({
      where: { tenantId: actor.tenantId, customerId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        number: true,
        subject: true,
        status: true,
        priority: true,
        source: true,
        bookingId: true,
        firstResponseDueAt: true,
        resolutionDueAt: true,
        satisfactionRating: true,
        createdAt: true,
        updatedAt: true,
        conversations: {
          select: { lastMessageAt: true, unreadAgentCount: true },
          orderBy: { lastMessageAt: 'desc' },
          take: 1,
        },
      },
    });
    // Flatten conversation hints onto the row for the mobile client.
    return items.map((t) => ({
      ...t,
      lastMessageAt: t.conversations[0]?.lastMessageAt ?? t.updatedAt,
      unreadCount: 0, // customer's own unread — populated when we wire `lastReadAt`.
    }));
  }

  @Post('tickets')
  @RequirePermissions(Permission.TICKET_CREATE)
  @ApiOperation({ summary: 'Open a new support ticket as the current customer.' })
  async create(
    @CurrentUser() actor: AuthPrincipal,
    @Body() dto: CreateMyTicketDto,
  ) {
    const customerId = await this.requireCustomer(actor);
    const ticket = await this.tickets.create(actor, {
      subject: dto.subject,
      description: dto.message,
      customerId,
      bookingId: dto.bookingId,
      amcSubscriptionId: dto.amcSubscriptionId,
      source: TicketSource.IN_APP_CHAT,
      priority: TicketPriority.NORMAL,
    });
    return ticket;
  }

  @Get('tickets/:id')
  @RequirePermissions(Permission.TICKET_VIEW)
  async detail(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    const customerId = await this.requireCustomer(actor);
    const ticket = await this.prisma.client.supportTicket.findFirst({
      where: { id, tenantId: actor.tenantId, customerId, deletedAt: null },
      select: {
        id: true,
        number: true,
        subject: true,
        description: true,
        status: true,
        priority: true,
        source: true,
        firstResponseDueAt: true,
        resolutionDueAt: true,
        firstResponseAt: true,
        resolvedAt: true,
        satisfactionRating: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  @Get('tickets/:id/messages')
  @RequirePermissions(Permission.TICKET_VIEW)
  async messages(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
  ) {
    const customerId = await this.requireCustomer(actor);
    const ticket = await this.prisma.client.supportTicket.findFirst({
      where: { id, tenantId: actor.tenantId, customerId, deletedAt: null },
      select: { id: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const messages = await this.prisma.client.ticketMessage.findMany({
      where: { ticketId: id, deletedAt: null, isInternal: false },
      orderBy: { createdAt: 'asc' },
      take: 500,
      select: {
        id: true,
        body: true,
        authorKind: true,
        channel: true,
        createdAt: true,
        author: { select: { firstName: true, lastName: true } },
      },
    });
    return messages;
  }

  @Post('tickets/:id/messages')
  @RequirePermissions(Permission.TICKET_VIEW)
  @ApiOperation({ summary: 'Send a customer reply on a ticket I own.' })
  async send(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: CustomerMessageDto,
  ) {
    const customerId = await this.requireCustomer(actor);
    const ticket = await this.prisma.client.supportTicket.findFirst({
      where: { id, tenantId: actor.tenantId, customerId, deletedAt: null },
      select: { id: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    // We treat this as inbound on the IN_APP_CHAT channel so it routes
    // through the same ingestion pipeline as WhatsApp / web-chat replies.
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: customerId, tenantId: actor.tenantId },
      select: { phone: true, email: true, userId: true },
    });
    if (!customer) throw new BadRequestException('Customer profile missing');
    const r = await this.conversations.ingestInbound({
      tenantId: actor.tenantId,
      channel: ConversationChannel.IN_APP_CHAT,
      threadIdentifier: `customer:${customerId}:ticket:${id}`,
      body: dto.body,
      customerLookupPhone: customer.phone,
      customerLookupEmail: customer.email ?? undefined,
      ticketId: id,
      rawPayload: { source: 'customer-app', authorKind: TicketAuthorKind.CUSTOMER },
    });
    return { ok: true, conversationId: r.conversationId, messageId: r.messageId };
  }

  @Post('tickets/:id/csat')
  @RequirePermissions(Permission.TICKET_VIEW)
  async csat(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: CsatRatingDto,
  ) {
    const customerId = await this.requireCustomer(actor);
    const ticket = await this.prisma.client.supportTicket.findFirst({
      where: { id, tenantId: actor.tenantId, customerId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return this.tickets.recordCsat(actor, id, dto);
  }

  // -------- helpers --------

  private async requireCustomer(actor: AuthPrincipal): Promise<string> {
    const customer = await this.prisma.client.customer.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) {
      throw new ForbiddenException('No customer profile linked to this account');
    }
    return customer.id;
  }
}

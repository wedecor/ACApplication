import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { randomUUID } from 'node:crypto';

import { ConversationChannel } from '@ac/types';

import { Public } from '../../common/decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConversationsService } from './conversations.service';

class StartChatDto {
  @IsString() @MinLength(1) @MaxLength(120)
  tenantSlug!: string;

  @IsOptional() @IsString() @MaxLength(120)
  name?: string;

  @IsOptional() @IsString() @MaxLength(16)
  phone?: string;

  @IsOptional() @IsEmail() @MaxLength(160)
  email?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  initialMessage?: string;

  /** Honeypot field — bots fill it, humans never see it. */
  @IsOptional() @IsString() @MaxLength(0)
  hp_url?: string;
}

class PostChatMessageDto {
  @IsString() @MinLength(1) @MaxLength(4000)
  body!: string;

  @IsOptional() @IsString()
  hp_url?: string;
}

/**
 * Public web-chat REST endpoints — used by the marketing site / customer
 * portal widget when WebSockets are unavailable (corporate proxies,
 * lossy mobile networks). Sessions are anonymous and rate-limited.
 *
 * The companion `LiveChatGateway` handles real-time delivery; this
 * controller is a degraded long-poll fallback that calls into the
 * exact same `ConversationsService.ingestInbound` codepath, so both
 * stay consistent.
 */
@ApiTags('public:web-chat')
@Controller({ path: 'public/web-chat', version: '1' })
export class PublicWebChatController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Start a brand-new chat session. The caller does NOT need to be
   * authenticated; we return a `sessionId` that they include on
   * subsequent requests to keep the conversation glued together.
   */
  @Public()
  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Open a new anonymous web-chat session.' })
  async start(@Body() dto: StartChatDto) {
    if (dto.hp_url && dto.hp_url.length > 0) {
      // Spam — pretend success to keep bots guessing.
      return { sessionId: randomUUID(), conversationId: null };
    }
    const tenantId = await this.resolveTenantId(dto.tenantSlug);
    const sessionId = `web-chat:${randomUUID()}`;
    const r = await this.conversations.ingestInbound({
      tenantId,
      channel: ConversationChannel.WEB_CHAT,
      threadIdentifier: sessionId,
      body: dto.initialMessage?.trim() || '[Session opened]',
      customerLookupPhone: dto.phone,
      customerLookupEmail: dto.email,
      fromName: dto.name,
      rawPayload: { sessionId, name: dto.name, phone: dto.phone, email: dto.email },
    });
    return {
      sessionId,
      conversationId: r.conversationId,
      ticketId: r.ticketId,
    };
  }

  @Public()
  @Post(':sessionId/messages')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Post a message into an existing web-chat session.' })
  async post(
    @Param('sessionId') sessionId: string,
    @Body() dto: PostChatMessageDto,
    @Query('tenantSlug') tenantSlug: string,
  ) {
    if (dto.hp_url && dto.hp_url.length > 0) {
      return { ok: true, messageId: null };
    }
    if (!tenantSlug) throw new BadRequestException('tenantSlug is required');
    const tenantId = await this.resolveTenantId(tenantSlug);
    const r = await this.conversations.ingestInbound({
      tenantId,
      channel: ConversationChannel.WEB_CHAT,
      threadIdentifier: sessionId,
      body: dto.body,
      rawPayload: { sessionId },
    });
    return { ok: true, conversationId: r.conversationId, messageId: r.messageId };
  }

  /**
   * Long-poll fallback: returns messages newer than `?after=<iso8601>`.
   * The widget polls this every few seconds when WebSocket isn't
   * available. Output is restricted to the customer's own session.
   */
  @Public()
  @Get(':sessionId/messages')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async list(
    @Param('sessionId') sessionId: string,
    @Query('tenantSlug') tenantSlug: string,
    @Query('after') after?: string,
  ) {
    if (!tenantSlug) throw new BadRequestException('tenantSlug is required');
    const tenantId = await this.resolveTenantId(tenantSlug);
    const conversation = await this.prisma.client.conversation.findFirst({
      where: {
        tenantId,
        channel: ConversationChannel.WEB_CHAT,
        externalThreadKey: `web_chat:${sessionId}`,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!conversation) return { items: [] };
    const messages = await this.prisma.client.conversationMessage.findMany({
      where: {
        conversationId: conversation.id,
        deletedAt: null,
        ...(after ? { createdAt: { gt: new Date(after) } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: {
        id: true,
        direction: true,
        body: true,
        createdAt: true,
        status: true,
      },
    });
    return { items: messages };
  }

  private async resolveTenantId(slug: string): Promise<string> {
    const tenant = await this.prisma.client.tenant.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true },
    });
    if (!tenant) throw new BadRequestException('Unknown tenant');
    return tenant.id;
  }
}

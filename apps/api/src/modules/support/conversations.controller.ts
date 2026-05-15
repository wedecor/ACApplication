import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ConversationStatus, Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import {
  AssignConversationDto,
  ListConversationsDto,
  ListMessagesDto,
  MarkReadDto,
  SendConversationMessageDto,
  TypingIndicatorDto,
} from './dto/conversation.dto';
import { ConversationsService } from './conversations.service';

@ApiTags('support:inbox')
@ApiBearerAuth()
@Controller({ path: 'support/inbox', version: '1' })
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get('conversations')
  @RequirePermissions(Permission.INBOX_VIEW)
  @ApiOperation({ summary: 'List omnichannel conversations.' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() dto: ListConversationsDto) {
    const r = await this.conversations.list(actor, dto);
    return { items: r.items, meta: buildPaginationMeta(r.page, r.pageSize, r.total) };
  }

  @Get('conversations/:id')
  @RequirePermissions(Permission.CONVERSATION_VIEW)
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.conversations.get(actor, id);
  }

  @Get('conversations/:id/messages')
  @RequirePermissions(Permission.CONVERSATION_VIEW)
  messages(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Query() dto: ListMessagesDto,
  ) {
    return this.conversations.listMessages(actor, id, dto);
  }

  @Post('conversations/:id/assign')
  @RequirePermissions(Permission.CONVERSATION_ASSIGN)
  assign(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: AssignConversationDto,
  ) {
    return this.conversations.assign(actor, id, dto);
  }

  @Post('conversations/:id/messages')
  @RequirePermissions(Permission.CONVERSATION_REPLY)
  @ApiOperation({ summary: 'Send a message on this conversation directly.' })
  send(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: SendConversationMessageDto,
  ) {
    return this.conversations.sendFromConversation(actor, id, dto);
  }

  @Post('conversations/:id/read')
  @RequirePermissions(Permission.CONVERSATION_VIEW)
  read(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: MarkReadDto,
  ) {
    return this.conversations.markRead(actor, id, dto);
  }

  @Post('conversations/:id/typing')
  @RequirePermissions(Permission.CONVERSATION_REPLY)
  typing(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: TypingIndicatorDto,
  ) {
    return this.conversations.typing(actor, id, dto);
  }

  @Post('conversations/:id/close')
  @RequirePermissions(Permission.INBOX_MANAGE)
  async close(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    await this.conversations.changeStatus(actor, id, ConversationStatus.CLOSED);
    return { ok: true };
  }

  @Post('conversations/:id/reopen')
  @RequirePermissions(Permission.INBOX_MANAGE)
  async reopen(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    await this.conversations.changeStatus(actor, id, ConversationStatus.OPEN);
    return { ok: true };
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import { CustomerContextService } from './customer-context.service';
import {
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
import { TicketsService } from './tickets.service';

@ApiTags('support:tickets')
@ApiBearerAuth()
@Controller({ path: 'support/tickets', version: '1' })
export class TicketsController {
  constructor(
    private readonly tickets: TicketsService,
    private readonly customerContext: CustomerContextService,
  ) {}

  @Post()
  @RequirePermissions(Permission.TICKET_CREATE)
  @ApiOperation({ summary: 'Create a new support ticket.' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateTicketDto) {
    return this.tickets.create(actor, dto);
  }

  @Get()
  @RequirePermissions(Permission.TICKET_VIEW)
  @ApiOperation({ summary: 'List tickets with filters + pagination.' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() dto: ListTicketsDto) {
    const r = await this.tickets.list(actor, dto);
    return { items: r.items, meta: buildPaginationMeta(r.page, r.pageSize, r.total) };
  }

  @Get(':id')
  @RequirePermissions(Permission.TICKET_VIEW)
  @ApiOperation({ summary: 'Get a ticket with full context.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.tickets.get(actor, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.TICKET_UPDATE)
  @ApiOperation({ summary: 'Update ticket fields (subject, priority, tags, SLA, etc).' })
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.tickets.update(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.TICKET_DELETE)
  @ApiOperation({ summary: 'Soft-delete a ticket.' })
  async remove(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    // Soft-delete via the close transition + a flag — keeps audit trail.
    await this.tickets.close(actor, id, 'Deleted by admin');
    return { ok: true };
  }

  @Post(':id/assign')
  @RequirePermissions(Permission.TICKET_ASSIGN)
  @ApiOperation({ summary: 'Assign or reassign a ticket to an agent / team.' })
  assign(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
  ) {
    return this.tickets.assign(actor, id, dto);
  }

  @Post(':id/escalate')
  @RequirePermissions(Permission.TICKET_ESCALATE)
  @ApiOperation({ summary: 'Manually escalate a ticket up the chain.' })
  escalate(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: EscalateTicketDto,
  ) {
    return this.tickets.escalate(actor, id, dto);
  }

  @Post(':id/status')
  @RequirePermissions(Permission.TICKET_UPDATE)
  @ApiOperation({ summary: 'Change ticket status (open / pending / waiting / resolved / closed).' })
  changeStatus(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.tickets.changeStatus(actor, id, dto);
  }

  @Post(':id/resolve')
  @RequirePermissions(Permission.TICKET_CLOSE)
  @ApiOperation({ summary: 'Resolve a ticket.' })
  resolve(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body('reason') reason?: string) {
    return this.tickets.resolve(actor, id, reason);
  }

  @Post(':id/close')
  @RequirePermissions(Permission.TICKET_CLOSE)
  @ApiOperation({ summary: 'Close a resolved ticket.' })
  close(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body('reason') reason?: string) {
    return this.tickets.close(actor, id, reason);
  }

  @Post(':id/reopen')
  @RequirePermissions(Permission.TICKET_REOPEN)
  @ApiOperation({ summary: 'Reopen a resolved / closed ticket.' })
  reopen(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body('reason') reason?: string) {
    return this.tickets.reopen(actor, id, reason);
  }

  @Post(':id/merge')
  @RequirePermissions(Permission.TICKET_MERGE)
  @ApiOperation({ summary: 'Merge this ticket into another.' })
  merge(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: MergeTicketDto,
  ) {
    return this.tickets.merge(actor, id, dto);
  }

  @Post(':id/notes')
  @RequirePermissions(Permission.TICKET_UPDATE)
  @ApiOperation({ summary: 'Add an internal note (or public message if isInternal=false).' })
  note(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: AddNoteDto,
  ) {
    return this.tickets.addNote(actor, id, dto);
  }

  @Post(':id/reply')
  @RequirePermissions(Permission.CONVERSATION_REPLY)
  @ApiOperation({ summary: 'Send an outbound reply on a chosen channel.' })
  reply(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: ReplyDto,
  ) {
    return this.tickets.reply(actor, id, dto);
  }

  @Post(':id/attachments')
  @RequirePermissions(Permission.TICKET_UPDATE)
  @ApiOperation({ summary: 'Attach files to the ticket / a message.' })
  addAttachments(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: AddAttachmentsDto,
  ) {
    return this.tickets.addAttachments(actor, id, dto);
  }

  @Post(':id/csat')
  @RequirePermissions(Permission.TICKET_VIEW)
  @ApiOperation({ summary: 'Record a CSAT rating + optional comment.' })
  csat(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: CsatDto,
  ) {
    return this.tickets.recordCsat(actor, id, dto);
  }

  @Get(':id/activities')
  @RequirePermissions(Permission.TICKET_VIEW)
  activities(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.tickets.getActivities(actor, id);
  }

  @Get(':id/messages')
  @RequirePermissions(Permission.TICKET_VIEW)
  messages(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.tickets.getMessages(actor, id);
  }

  @Get(':id/customer-context')
  @RequirePermissions(Permission.TICKET_VIEW)
  @ApiOperation({ summary: 'Aggregated customer-context panel for this ticket.' })
  async customerContextForTicket(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
  ) {
    const ticket = await this.tickets.requireTicket(actor.tenantId, id);
    if (!ticket.customerId) return { customer: null };
    return this.customerContext.getContext(actor, ticket.customerId);
  }
}

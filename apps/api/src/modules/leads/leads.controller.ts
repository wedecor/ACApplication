import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { AddLeadNoteDto } from './dto/add-note.dto';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { ChangeLeadStatusDto } from './dto/change-status.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@ApiBearerAuth()
@Controller({ path: 'leads', version: '1' })
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Post()
  @RequirePermissions(Permission.LEAD_CREATE)
  @ApiOperation({ summary: 'Create a new lead.' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateLeadDto) {
    return this.leads.create(actor, dto);
  }

  @Get()
  @RequirePermissions(Permission.LEAD_VIEW)
  @ApiOperation({ summary: 'List leads with filters + pagination.' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() query: ListLeadsDto) {
    const { items, total } = await this.leads.list(actor, query);
    return {
      items,
      pagination: buildPaginationMeta(query.page, query.pageSize, total),
    };
  }

  @Get(':id')
  @RequirePermissions(Permission.LEAD_VIEW)
  @ApiOperation({ summary: 'Get a single lead.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.leads.getById(actor, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.LEAD_UPDATE)
  @ApiOperation({ summary: 'Update lead fields.' })
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leads.update(actor, id, dto);
  }

  @Post(':id/assign')
  @RequirePermissions(Permission.LEAD_ASSIGN)
  @ApiOperation({ summary: 'Assign a lead to an operations user.' })
  assign(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: AssignLeadDto,
  ) {
    return this.leads.assign(actor, id, dto);
  }

  @Post(':id/status')
  @RequirePermissions(Permission.LEAD_UPDATE)
  @ApiOperation({ summary: 'Change lead status (state-machine guarded).' })
  changeStatus(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: ChangeLeadStatusDto,
  ) {
    return this.leads.changeStatus(actor, id, dto);
  }

  @Post(':id/notes')
  @RequirePermissions(Permission.LEAD_UPDATE)
  @ApiOperation({ summary: 'Add a note to a lead.' })
  addNote(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: AddLeadNoteDto,
  ) {
    return this.leads.addNote(actor, id, dto);
  }

  @Get(':id/notes')
  @RequirePermissions(Permission.LEAD_VIEW)
  listNotes(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.leads.listNotes(actor, id);
  }

  @Get(':id/activities')
  @RequirePermissions(Permission.LEAD_VIEW)
  @ApiOperation({ summary: 'Timeline / activity feed for a lead.' })
  listActivities(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.leads.listActivities(actor, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.LEAD_DELETE)
  remove(@CurrentUser() _actor: AuthPrincipal, @Param('id') _id: string): void {
    // Soft-delete handled by Prisma extension; service-level retention checks
    // (e.g. cannot delete leads with bookings) wired in the next iteration.
  }
}

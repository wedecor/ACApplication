import type { AuthPrincipal } from '@ac/auth';
import { Permission } from '@ac/types';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, RequirePermissions } from '../../../common/decorators';
import { buildPaginationMeta } from '../../../common/dto/pagination.dto';
import { CreateWorkshopJobDto, ListWorkshopJobsDto, TransitionWorkshopJobDto } from './dto/workshop.dto';
import { WorkshopService } from './workshop.service';

@ApiTags('repair')
@ApiBearerAuth()
@Controller({ path: 'repair/workshop-jobs', version: '1' })
export class WorkshopController {
  constructor(private readonly workshop: WorkshopService) {}

  @Get()
  @RequirePermissions(Permission.WORKSHOP_VIEW)
  @ApiOperation({ summary: 'List workshop (pickup/drop, carry-in) jobs.' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() query: ListWorkshopJobsDto) {
    const { items, total } = await this.workshop.list(actor, query);
    return { items, pagination: buildPaginationMeta(query.page, query.pageSize, total) };
  }

  @Post()
  @RequirePermissions(Permission.WORKSHOP_MANAGE)
  @ApiOperation({ summary: 'Create a workshop job for a booking.' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateWorkshopJobDto) {
    return this.workshop.create(actor, dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.WORKSHOP_VIEW)
  @ApiOperation({ summary: 'Get one workshop job (includes allowed transitions).' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.workshop.get(actor, id);
  }

  @Post(':id/transition')
  @RequirePermissions(Permission.WORKSHOP_MANAGE)
  @ApiOperation({ summary: 'Move a workshop job to the next status (state-machine guarded).' })
  transition(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: TransitionWorkshopJobDto,
  ) {
    return this.workshop.transition(actor, id, dto);
  }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import {
  ChangeStageDto,
  CreateOpportunityDto,
  ListOpportunitiesDto,
  OpportunityFromLeadDto,
  PipelineQueryDto,
  UpdateOpportunityDto,
} from './dto/opportunity.dto';
import { OpportunitiesService } from './opportunities.service';

@ApiTags('sales')
@ApiBearerAuth()
@Controller({ path: 'opportunities', version: '1' })
export class OpportunitiesController {
  constructor(private readonly opportunities: OpportunitiesService) {}

  @Get()
  @RequirePermissions(Permission.OPPORTUNITY_VIEW)
  @ApiOperation({ summary: 'List opportunities.' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() query: ListOpportunitiesDto) {
    const { items, total } = await this.opportunities.list(actor, query);
    return { items, pagination: buildPaginationMeta(query.page, query.pageSize, total) };
  }

  @Get('pipeline')
  @RequirePermissions(Permission.OPPORTUNITY_VIEW)
  @ApiOperation({ summary: 'Pipeline summary: count + value per stage and weighted forecast.' })
  pipeline(@CurrentUser() actor: AuthPrincipal, @Query() query: PipelineQueryDto) {
    return this.opportunities.pipeline(actor, query.ownerUserId);
  }

  @Post()
  @RequirePermissions(Permission.OPPORTUNITY_MANAGE)
  @ApiOperation({ summary: 'Create an opportunity.' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateOpportunityDto) {
    return this.opportunities.create(actor, dto);
  }

  @Post('from-lead/:leadId')
  @RequirePermissions(Permission.OPPORTUNITY_MANAGE)
  @ApiOperation({ summary: 'Convert a lead into an opportunity.' })
  fromLead(
    @CurrentUser() actor: AuthPrincipal,
    @Param('leadId') leadId: string,
    @Body() dto: OpportunityFromLeadDto,
  ) {
    return this.opportunities.createFromLead(actor, leadId, dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.OPPORTUNITY_VIEW)
  @ApiOperation({ summary: 'Get an opportunity.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.opportunities.get(actor, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.OPPORTUNITY_MANAGE)
  @ApiOperation({ summary: 'Update an opportunity.' })
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateOpportunityDto,
  ) {
    return this.opportunities.update(actor, id, dto);
  }

  @Post(':id/stage')
  @RequirePermissions(Permission.OPPORTUNITY_MANAGE)
  @ApiOperation({ summary: 'Move an opportunity to a new stage (WON/LOST stamp closedAt).' })
  changeStage(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: ChangeStageDto,
  ) {
    return this.opportunities.changeStage(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.OPPORTUNITY_MANAGE)
  @ApiOperation({ summary: 'Soft-delete an opportunity.' })
  remove(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.opportunities.remove(actor, id);
  }
}

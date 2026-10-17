import type { AuthPrincipal } from '@ac/auth';
import { Permission } from '@ac/types';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, RequirePermissions } from '../../../common/decorators';
import { ChecklistsService } from './checklists.service';
import {
  CreateChecklistTemplateDto,
  ListChecklistsDto,
  UpdateChecklistTemplateDto,
} from './dto/checklist.dto';

@ApiTags('repair')
@ApiBearerAuth()
@Controller({ path: 'repair/checklists', version: '1' })
export class ChecklistsController {
  constructor(private readonly checklists: ChecklistsService) {}

  @Get()
  @RequirePermissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'List checklist templates (filter by category, kind).' })
  list(@CurrentUser() actor: AuthPrincipal, @Query() query: ListChecklistsDto) {
    return this.checklists.list(actor, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'Get one checklist template.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.checklists.get(actor, id);
  }

  @Post()
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Create a checklist template.' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateChecklistTemplateDto) {
    return this.checklists.create(actor, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Update a checklist template (bumps version when items change).' })
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateChecklistTemplateDto,
  ) {
    return this.checklists.update(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Soft-delete a checklist template.' })
  remove(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.checklists.remove(actor, id);
  }
}

import type { AuthPrincipal } from '@ac/auth';
import { Permission } from '@ac/types';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, RequirePermissions } from '../../../common/decorators';
import { CatalogService } from './catalog.service';
import { CreateCatalogItemDto, ListCatalogDto, UpdateCatalogItemDto } from './dto/catalog.dto';

@ApiTags('repair')
@ApiBearerAuth()
@Controller({ path: 'repair/catalog', version: '1' })
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @RequirePermissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'List service catalog (rate card) items.' })
  list(@CurrentUser() actor: AuthPrincipal, @Query() query: ListCatalogDto) {
    return this.catalog.list(actor, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'Get one catalog item.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.catalog.get(actor, id);
  }

  @Post()
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Create a catalog item.' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateCatalogItemDto) {
    return this.catalog.create(actor, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Update a catalog item.' })
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateCatalogItemDto,
  ) {
    return this.catalog.update(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Soft-delete a catalog item.' })
  remove(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.catalog.remove(actor, id);
  }
}

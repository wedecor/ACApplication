import type { AuthPrincipal } from '@ac/auth';
import { Permission } from '@ac/types';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, RequirePermissions } from '../../../common/decorators';
import { CreateFaultCodeDto, ListFaultCodesDto, UpdateFaultCodeDto } from './dto/fault-code.dto';
import { FaultCodesService } from './fault-codes.service';

@ApiTags('repair')
@ApiBearerAuth()
@Controller({ path: 'repair/fault-codes', version: '1' })
export class FaultCodesController {
  constructor(private readonly faultCodes: FaultCodesService) {}

  @Get()
  @RequirePermissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'List fault codes (filter by category, brand, free text).' })
  list(@CurrentUser() actor: AuthPrincipal, @Query() query: ListFaultCodesDto) {
    return this.faultCodes.list(actor, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'Get one fault code.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.faultCodes.get(actor, id);
  }

  @Post()
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Create a fault code.' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateFaultCodeDto) {
    return this.faultCodes.create(actor, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Update a fault code.' })
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateFaultCodeDto,
  ) {
    return this.faultCodes.update(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Soft-delete a fault code.' })
  remove(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.faultCodes.remove(actor, id);
  }
}

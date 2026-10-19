import type { AuthPrincipal } from '@ac/auth';
import { Permission } from '@ac/types';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AllowAuthenticated, CurrentUser, RequirePermissions } from '../../common/decorators';
import { CustomFieldsService } from './custom-fields.service';
import {
  CreateCustomFieldDto,
  ListCustomFieldsDto,
  UpdateCustomFieldDto,
} from './dto/custom-field.dto';

@ApiTags('productivity')
@ApiBearerAuth()
@Controller({ path: 'custom-fields', version: '1' })
export class CustomFieldsController {
  constructor(private readonly fields: CustomFieldsService) {}

  @Get()
  @AllowAuthenticated()
  @ApiOperation({ summary: 'List custom field definitions (used to render forms).' })
  list(@CurrentUser() actor: AuthPrincipal, @Query() query: ListCustomFieldsDto) {
    return this.fields.list(actor, query);
  }

  @Post()
  @RequirePermissions(Permission.CUSTOM_FIELD_MANAGE)
  @ApiOperation({ summary: 'Create a custom field definition.' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateCustomFieldDto) {
    return this.fields.create(actor, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CUSTOM_FIELD_MANAGE)
  @ApiOperation({ summary: 'Update a custom field definition (entity/key immutable).' })
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateCustomFieldDto,
  ) {
    return this.fields.update(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.CUSTOM_FIELD_MANAGE)
  @ApiOperation({ summary: 'Delete a custom field definition.' })
  remove(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.fields.remove(actor, id);
  }
}

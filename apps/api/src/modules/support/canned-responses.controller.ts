import type { AuthPrincipal } from '@ac/auth';
import { Permission } from '@ac/types';
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

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import { CannedResponsesService } from './canned-responses.service';
import {
  CreateCannedResponseDto,
  ListCannedResponsesDto,
  UpdateCannedResponseDto,
} from './dto/canned-response.dto';

@ApiTags('support:canned-responses')
@ApiBearerAuth()
@Controller({ path: 'support/canned-responses', version: '1' })
export class CannedResponsesController {
  constructor(private readonly canned: CannedResponsesService) {}

  @Get()
  @RequirePermissions(Permission.CANNED_RESPONSE_VIEW)
  @ApiOperation({ summary: 'List canned responses with pagination.' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() dto: ListCannedResponsesDto) {
    const r = await this.canned.list(actor, dto);
    return { items: r.items, meta: buildPaginationMeta(r.page, r.pageSize, r.total) };
  }

  @Post()
  @RequirePermissions(Permission.CANNED_RESPONSE_MANAGE)
  @ApiOperation({ summary: 'Create a new canned response template.' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateCannedResponseDto) {
    return this.canned.create(actor, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CANNED_RESPONSE_MANAGE)
  @ApiOperation({ summary: 'Update an existing canned response template.' })
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateCannedResponseDto,
  ) {
    return this.canned.update(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.CANNED_RESPONSE_MANAGE)
  @ApiOperation({ summary: 'Delete a canned response template.' })
  delete(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.canned.delete(actor, id);
  }

  @Post(':id/use')
  @RequirePermissions(Permission.CANNED_RESPONSE_VIEW)
  @ApiOperation({ summary: 'Increment usage counter for a canned response.' })
  use(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.canned.incrementUsage(actor, id);
  }
}

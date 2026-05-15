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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import {
  CreateCannedResponseDto,
  ListCannedResponsesDto,
  UpdateCannedResponseDto,
} from './dto/canned-response.dto';
import { CannedResponsesService } from './canned-responses.service';

@ApiTags('support:canned-responses')
@ApiBearerAuth()
@Controller({ path: 'support/canned-responses', version: '1' })
export class CannedResponsesController {
  constructor(private readonly canned: CannedResponsesService) {}

  @Get()
  @RequirePermissions(Permission.CANNED_RESPONSE_VIEW)
  async list(@CurrentUser() actor: AuthPrincipal, @Query() dto: ListCannedResponsesDto) {
    const r = await this.canned.list(actor, dto);
    return { items: r.items, meta: buildPaginationMeta(r.page, r.pageSize, r.total) };
  }

  @Post()
  @RequirePermissions(Permission.CANNED_RESPONSE_MANAGE)
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateCannedResponseDto) {
    return this.canned.create(actor, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CANNED_RESPONSE_MANAGE)
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateCannedResponseDto,
  ) {
    return this.canned.update(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.CANNED_RESPONSE_MANAGE)
  delete(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.canned.delete(actor, id);
  }

  @Post(':id/use')
  @RequirePermissions(Permission.CANNED_RESPONSE_VIEW)
  use(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.canned.incrementUsage(actor, id);
  }
}

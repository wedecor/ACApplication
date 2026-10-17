import type { AuthPrincipal } from '@ac/auth';
import { Permission } from '@ac/types';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, RequirePermissions } from '../../../common/decorators';
import { buildPaginationMeta } from '../../../common/dto/pagination.dto';
import {
  CreateWarrantyClaimDto,
  DecideWarrantyClaimDto,
  ListWarrantyClaimsDto,
  ScheduleRevisitDto,
  UpdateOemClaimDto,
  WarrantyCheckDto,
} from './dto/warranty.dto';
import { WarrantyService } from './warranty.service';

@ApiTags('repair')
@ApiBearerAuth()
@Controller({ path: 'repair', version: '1' })
export class WarrantyController {
  constructor(private readonly warranty: WarrantyService) {}

  @Get('warranty/check')
  @RequirePermissions(Permission.WARRANTY_VIEW)
  @ApiOperation({ summary: 'Check repair / manufacturer warranty eligibility by booking or appliance.' })
  check(@CurrentUser() actor: AuthPrincipal, @Query() query: WarrantyCheckDto) {
    return this.warranty.check(actor, query);
  }

  @Get('warranty-claims')
  @RequirePermissions(Permission.WARRANTY_VIEW)
  @ApiOperation({ summary: 'List warranty claims.' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() query: ListWarrantyClaimsDto) {
    const { items, total } = await this.warranty.list(actor, query);
    return { items, pagination: buildPaginationMeta(query.page, query.pageSize, total) };
  }

  @Post('warranty-claims')
  @RequirePermissions(Permission.WARRANTY_MANAGE)
  @ApiOperation({ summary: 'Raise a warranty claim (repair revisit or OEM claim).' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateWarrantyClaimDto) {
    return this.warranty.create(actor, dto);
  }

  @Get('warranty-claims/:id')
  @RequirePermissions(Permission.WARRANTY_VIEW)
  @ApiOperation({ summary: 'Get one warranty claim.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.warranty.get(actor, id);
  }

  @Post('warranty-claims/:id/decide')
  @RequirePermissions(Permission.WARRANTY_MANAGE)
  @ApiOperation({ summary: 'Approve or reject an OPEN claim.' })
  decide(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: DecideWarrantyClaimDto,
  ) {
    return this.warranty.decide(actor, id, dto);
  }

  @Post('warranty-claims/:id/revisit')
  @RequirePermissions(Permission.WARRANTY_MANAGE, Permission.BOOKING_CREATE)
  @ApiOperation({ summary: 'Schedule the zero-charge revisit booking for an approved claim.' })
  revisit(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: ScheduleRevisitDto,
  ) {
    return this.warranty.scheduleRevisit(actor, id, dto);
  }

  @Post('warranty-claims/:id/oem')
  @RequirePermissions(Permission.WARRANTY_MANAGE)
  @ApiOperation({ summary: 'Record OEM submission / settlement for an OEM claim.' })
  oem(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateOemClaimDto,
  ) {
    return this.warranty.updateOem(actor, id, dto);
  }
}

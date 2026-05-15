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

import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import {
  CreateVendorDto,
  ListVendorsDto,
  RateVendorDto,
  UpdateVendorDto,
} from './dto/vendor.dto';
import { VendorsService } from './vendors.service';

@ApiTags('inventory:vendors')
@ApiBearerAuth()
@Controller({ path: 'inventory/vendors', version: '1' })
export class VendorsController {
  constructor(private readonly vendors: VendorsService) {}

  @Post()
  @RequirePermissions(Permission.VENDOR_MANAGE)
  @ApiOperation({ summary: 'Create a vendor.' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateVendorDto) {
    return this.vendors.create(actor, dto);
  }

  @Get()
  @RequirePermissions(Permission.VENDOR_VIEW)
  @ApiOperation({ summary: 'List vendors.' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() dto: ListVendorsDto) {
    const r = await this.vendors.list(actor, dto);
    return { items: r.items, meta: buildPaginationMeta(r.page, r.pageSize, r.total) };
  }

  @Get(':id')
  @RequirePermissions(Permission.VENDOR_VIEW)
  @ApiOperation({ summary: 'Get a vendor with recent POs.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.vendors.get(actor, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.VENDOR_MANAGE)
  @ApiOperation({ summary: 'Update a vendor.' })
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
  ) {
    return this.vendors.update(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.VENDOR_MANAGE)
  @ApiOperation({ summary: 'Blacklist + soft-delete a vendor (no open POs).' })
  delete(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.vendors.softDelete(actor, id);
  }

  @Post(':id/rate')
  @RequirePermissions(Permission.VENDOR_MANAGE)
  @ApiOperation({ summary: 'Record a manual rating (0–5, EMA-smoothed).' })
  rate(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: RateVendorDto,
  ) {
    return this.vendors.rate(actor, id, dto);
  }
}

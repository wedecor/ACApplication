import type { AuthPrincipal } from '@ac/auth';
import { Permission } from '@ac/types';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import { CustomersService } from './customers.service';
import {
  CreateCustomerDto,
  FindDuplicatesDto,
  MergeCustomerDto,
  UpdateCustomerDto,
} from './dto/customer-write.dto';
import { ListCustomersDto } from './dto/list-customers.dto';

@ApiTags('customers')
@ApiBearerAuth()
@Controller({ path: 'customers', version: '1' })
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions(Permission.CUSTOMER_READ)
  @ApiOperation({ summary: 'List customers with search and pagination (merged records excluded).' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() query: ListCustomersDto) {
    const { items, total } = await this.customers.list(actor, query);
    return {
      items,
      pagination: buildPaginationMeta(query.page, query.pageSize, total),
    };
  }

  @Get('duplicates')
  @RequirePermissions(Permission.CUSTOMER_READ)
  @ApiOperation({ summary: 'Find likely duplicates for a phone / email / name + pincode probe.' })
  findDuplicates(@CurrentUser() actor: AuthPrincipal, @Query() query: FindDuplicatesDto) {
    return this.customers.findDuplicates(actor, query);
  }

  @Post()
  @RequirePermissions(Permission.CUSTOMER_WRITE)
  @ApiOperation({ summary: 'Create a customer (and its login identity).' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateCustomerDto) {
    return this.customers.create(actor, dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.CUSTOMER_READ)
  @ApiOperation({ summary: 'Get a customer by id.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.customers.get(actor, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CUSTOMER_WRITE)
  @ApiOperation({ summary: 'Update customer profile, tags, custom fields, account link.' })
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(actor, id, dto);
  }

  @Get(':id/duplicates')
  @RequirePermissions(Permission.CUSTOMER_READ)
  @ApiOperation({ summary: 'List likely duplicates of this customer.' })
  duplicatesOf(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.customers.duplicatesOf(actor, id);
  }

  @Post(':id/merge')
  @RequirePermissions(Permission.CUSTOMER_MERGE)
  @ApiOperation({ summary: 'Merge this (duplicate) customer into another; returns the survivor.' })
  merge(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: MergeCustomerDto,
  ) {
    return this.customers.merge(actor, id, dto.intoCustomerId);
  }
}

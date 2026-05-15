import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import { CustomersService } from './customers.service';
import { ListCustomersDto } from './dto/list-customers.dto';

@ApiTags('customers')
@ApiBearerAuth()
@Controller({ path: 'customers', version: '1' })
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions(Permission.CUSTOMER_READ)
  @ApiOperation({ summary: 'List customers with search and pagination.' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() query: ListCustomersDto) {
    const { items, total } = await this.customers.list(actor, query);
    return {
      items,
      pagination: buildPaginationMeta(query.page, query.pageSize, total),
    };
  }

  @Get(':id')
  @RequirePermissions(Permission.CUSTOMER_READ)
  @ApiOperation({ summary: 'Get a customer by id.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.customers.get(actor, id);
  }
}

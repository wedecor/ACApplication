import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import { AccountsService } from './accounts.service';
import {
  CreateAccountDto,
  LinkCustomersDto,
  ListAccountsDto,
  UpdateAccountDto,
} from './dto/account.dto';

@ApiTags('sales')
@ApiBearerAuth()
@Controller({ path: 'accounts', version: '1' })
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @RequirePermissions(Permission.ACCOUNT_VIEW)
  @ApiOperation({ summary: 'List B2B accounts.' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() query: ListAccountsDto) {
    const { items, total } = await this.accounts.list(actor, query);
    return { items, pagination: buildPaginationMeta(query.page, query.pageSize, total) };
  }

  @Post()
  @RequirePermissions(Permission.ACCOUNT_MANAGE)
  @ApiOperation({ summary: 'Create a B2B account.' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateAccountDto) {
    return this.accounts.create(actor, dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.ACCOUNT_VIEW)
  @ApiOperation({ summary: 'Account detail with customers, bookings, AMC and revenue.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.accounts.get(actor, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.ACCOUNT_MANAGE)
  @ApiOperation({ summary: 'Update an account.' })
  update(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.accounts.update(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.ACCOUNT_MANAGE)
  @ApiOperation({ summary: 'Soft-delete an account and unlink its customers.' })
  remove(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.accounts.remove(actor, id);
  }

  @Post(':id/customers')
  @RequirePermissions(Permission.ACCOUNT_MANAGE)
  @ApiOperation({ summary: 'Link customers to an account.' })
  link(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body() dto: LinkCustomersDto) {
    return this.accounts.linkCustomers(actor, id, dto);
  }

  @Delete(':id/customers/:customerId')
  @RequirePermissions(Permission.ACCOUNT_MANAGE)
  @ApiOperation({ summary: 'Unlink a customer from an account.' })
  unlink(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Param('customerId') customerId: string,
  ) {
    return this.accounts.unlinkCustomer(actor, id, customerId);
  }
}

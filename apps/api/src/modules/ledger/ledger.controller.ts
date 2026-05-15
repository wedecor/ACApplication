import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Permission } from '@ac/types';

import { RequirePermissions } from '../../common/decorators';
import { LedgerService } from './ledger.service';

@ApiTags('finance')
@ApiBearerAuth()
@Controller({ path: 'customers/:customerId/ledger', version: '1' })
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get()
  @RequirePermissions(Permission.LEDGER_VIEW)
  @ApiOperation({ summary: 'Statement of account for a customer.' })
  async statement(
    @Param('customerId') customerId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const result = await this.ledger.statement(customerId, {
      fromDate: from ? new Date(from) : undefined,
      toDate: to ? new Date(to) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
      cursor: cursor || undefined,
    });
    const outstandingMinor = await this.ledger.outstandingForCustomer(customerId);
    return { ...result, outstandingMinor };
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Permission, PayoutStatus } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import {
  AdjustCommissionDto,
  ApprovePayoutDto,
  CreatePayoutDto,
  MarkPayoutPaidDto,
  UpsertCommissionRuleDto,
} from './dto/payouts.dto';
import { PayoutsService } from './payouts.service';

@ApiTags('payouts')
@ApiBearerAuth()
@Controller({ path: 'payouts', version: '1' })
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Patch('rules/:technicianId')
  @RequirePermissions(Permission.PAYOUT_APPROVE)
  @ApiOperation({ summary: 'Set / replace the commission rule for a technician.' })
  upsertRule(
    @CurrentUser() actor: AuthPrincipal,
    @Param('technicianId') technicianId: string,
    @Body() dto: UpsertCommissionRuleDto,
  ) {
    return this.payouts.upsertRule(actor, technicianId, dto);
  }

  @Patch('commissions/:id/adjust')
  @RequirePermissions(Permission.PAYOUT_APPROVE)
  adjust(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: AdjustCommissionDto,
  ) {
    return this.payouts.adjustCommission(actor, id, dto);
  }

  @Post('commissions/:id/reverse')
  @RequirePermissions(Permission.PAYOUT_APPROVE)
  @HttpCode(HttpStatus.OK)
  reverse(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.payouts.reverseCommission(actor, id);
  }

  @Post()
  @RequirePermissions(Permission.PAYOUT_APPROVE)
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreatePayoutDto) {
    return this.payouts.createPayout(actor, dto);
  }

  @Get()
  @RequirePermissions(Permission.PAYOUT_VIEW)
  list(
    @CurrentUser() actor: AuthPrincipal,
    @Query('status') status?: PayoutStatus,
    @Query('technicianId') technicianId?: string,
  ) {
    return this.payouts.listPayouts(actor, { status, technicianId });
  }

  @Get('pending/:technicianId')
  @RequirePermissions(Permission.PAYOUT_VIEW)
  pending(@CurrentUser() actor: AuthPrincipal, @Param('technicianId') technicianId: string) {
    return this.payouts.pendingForTechnician(actor, technicianId);
  }

  @Get(':id')
  @RequirePermissions(Permission.PAYOUT_VIEW)
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.payouts.getPayout(actor, id);
  }

  @Post(':id/approve')
  @RequirePermissions(Permission.PAYOUT_APPROVE)
  @HttpCode(HttpStatus.OK)
  approve(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: ApprovePayoutDto,
  ) {
    return this.payouts.approve(actor, id, dto);
  }

  @Post(':id/mark-paid')
  @RequirePermissions(Permission.PAYOUT_PROCESS)
  @HttpCode(HttpStatus.OK)
  markPaid(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: MarkPayoutPaidDto,
  ) {
    return this.payouts.markPaid(actor, id, dto);
  }

  @Post(':id/fail')
  @RequirePermissions(Permission.PAYOUT_PROCESS)
  @HttpCode(HttpStatus.OK)
  fail(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.payouts.fail(actor, id, body.reason);
  }
}

import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { FinanceAnalyticsService } from './finance-analytics.service';

function parseRange(from?: string, to?: string) {
  const now = new Date();
  return {
    from: from ? new Date(from) : new Date(now.getTime() - 30 * 86_400_000),
    to: to ? new Date(to) : new Date(now.getTime() + 86_400_000),
  };
}

@ApiTags('finance-analytics')
@ApiBearerAuth()
@Controller({ path: 'finance', version: '1' })
export class FinanceAnalyticsController {
  constructor(private readonly svc: FinanceAnalyticsService) {}

  @Get('overview')
  @RequirePermissions(Permission.FINANCE_VIEW)
  @ApiOperation({ summary: 'Headline KPIs for the finance dashboard.' })
  async overview(
    @CurrentUser() actor: AuthPrincipal,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.overview(actor.tenantId, parseRange(from, to));
  }

  @Get('revenue-series')
  @RequirePermissions(Permission.FINANCE_VIEW)
  async revenue(
    @CurrentUser() actor: AuthPrincipal,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const rows = await this.svc.revenueSeries(actor.tenantId, parseRange(from, to));
    return rows.map((r) => ({
      day: r.day,
      revenueMinor: Number(r.revenue_minor),
      collectedMinor: Number(r.collected_minor),
      taxMinor: Number(r.tax_minor),
    }));
  }

  @Get('top-customers')
  @RequirePermissions(Permission.FINANCE_VIEW)
  async topCustomers(
    @CurrentUser() actor: AuthPrincipal,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const rows = await this.svc.topCustomers(
      actor.tenantId,
      parseRange(from, to),
      limit ? Number.parseInt(limit, 10) : 10,
    );
    return rows.map((r) => ({
      customerId: r.customer_id,
      fullName: r.full_name,
      invoicedMinor: Number(r.invoiced),
      paidMinor: Number(r.paid),
      outstandingMinor: Number(r.outstanding),
      invoices: Number(r.invoices),
    }));
  }

  @Get('revenue-by-city')
  @RequirePermissions(Permission.FINANCE_VIEW)
  async byCity(
    @CurrentUser() actor: AuthPrincipal,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const rows = await this.svc.revenueByCity(actor.tenantId, parseRange(from, to));
    return rows.map((r) => ({
      cityId: r.city_id,
      city: r.city,
      revenueMinor: Number(r.revenue_minor),
      bookings: Number(r.bookings),
    }));
  }

  @Get('aging')
  @RequirePermissions(Permission.FINANCE_VIEW)
  aging(@CurrentUser() actor: AuthPrincipal) {
    return this.svc.outstandingAging(actor.tenantId);
  }

  @Get('payout-pipeline')
  @RequirePermissions(Permission.PAYOUT_VIEW)
  payouts(@CurrentUser() actor: AuthPrincipal) {
    return this.svc.payoutPipeline(actor.tenantId);
  }
}

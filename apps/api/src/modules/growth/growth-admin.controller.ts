import type { AuthPrincipal } from '@ac/auth';
import { Permission } from '@ac/types';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta, PaginationDto } from '../../common/dto/pagination.dto';
import { CampaignsService } from './campaigns.service';
import { CouponsService } from './coupons.service';
import {
  AdminValidateCouponDto,
  CreateCouponDto,
  ListCouponsDto,
  UpdateCouponDto,
} from './dto/coupon.dto';
import {
  AdjustLoyaltyDto,
  CreateCampaignDto,
  CreateSegmentDto,
  ListCampaignsDto,
  ListReferralsDto,
  NpsQueryDto,
  OverrideReferralDto,
  ScheduleCampaignDto,
  SegmentRulesBodyDto,
  UpdateCampaignDto,
  UpdateSegmentDto,
} from './dto/growth.dto';
import { LoyaltyService } from './loyalty.service';
import { ReferralsService } from './referrals.service';
import { ReviewsService } from './reviews.service';
import { SegmentsService } from './segments.service';

// ------------------------------------------------------------------ coupons
@ApiTags('growth-coupons')
@ApiBearerAuth()
@Controller({ path: 'coupons', version: '1' })
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  @RequirePermissions(Permission.MARKETING_VIEW)
  @ApiOperation({ summary: 'List coupons.' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() q: ListCouponsDto) {
    const { items, total } = await this.coupons.list(actor, q);
    return { items, pagination: buildPaginationMeta(q.page, q.pageSize, total) };
  }

  @Post()
  @RequirePermissions(Permission.MARKETING_MANAGE)
  @ApiOperation({ summary: 'Create a coupon.' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateCouponDto) {
    return this.coupons.create(actor, dto);
  }

  @Post('validate')
  @HttpCode(200)
  @RequirePermissions(Permission.MARKETING_VIEW)
  @ApiOperation({ summary: 'Validate a coupon code for a customer (staff-side).' })
  async validate(@CurrentUser() actor: AuthPrincipal, @Body() dto: AdminValidateCouponDto) {
    const r = await this.coupons.validate(actor.tenantId, dto.customerId, dto.code, {
      category: dto.category,
      amountMinor: dto.amountMinor,
    });
    return { valid: r.valid, discountMinor: r.discountMinor, ...(r.message ? { message: r.message } : {}) };
  }

  @Get(':id')
  @RequirePermissions(Permission.MARKETING_VIEW)
  @ApiOperation({ summary: 'Get a coupon.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.coupons.get(actor, id);
  }

  @Get(':id/redemptions')
  @RequirePermissions(Permission.MARKETING_VIEW)
  @ApiOperation({ summary: 'List redemptions of a coupon.' })
  async redemptions(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Query() q: PaginationDto,
  ) {
    const { items, total } = await this.coupons.redemptions(actor, id, q.page, q.pageSize);
    return { items, pagination: buildPaginationMeta(q.page, q.pageSize, total) };
  }

  @Patch(':id')
  @RequirePermissions(Permission.MARKETING_MANAGE)
  @ApiOperation({ summary: 'Update a coupon.' })
  update(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.coupons.update(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MARKETING_MANAGE)
  @ApiOperation({ summary: 'Soft-delete a coupon.' })
  remove(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.coupons.remove(actor, id);
  }
}

// ---------------------------------------------------------------- referrals
@ApiTags('growth-referrals')
@ApiBearerAuth()
@Controller({ path: 'referrals', version: '1' })
export class ReferralsAdminController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get()
  @RequirePermissions(Permission.MARKETING_VIEW)
  @ApiOperation({ summary: 'List referrals.' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() q: ListReferralsDto) {
    const { items, total } = await this.referrals.list(actor.tenantId, q);
    return { items, pagination: buildPaginationMeta(q.page, q.pageSize, total) };
  }

  @Get('stats')
  @RequirePermissions(Permission.MARKETING_VIEW)
  @ApiOperation({ summary: 'Referral funnel counts.' })
  stats(@CurrentUser() actor: AuthPrincipal) {
    return this.referrals.stats(actor.tenantId);
  }

  @Patch(':id')
  @RequirePermissions(Permission.MARKETING_MANAGE)
  @ApiOperation({ summary: 'Override a referral status / reward (REWARDED credits the referrer).' })
  override(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body() dto: OverrideReferralDto) {
    return this.referrals.override(actor.tenantId, id, dto);
  }
}

// ----------------------------------------------------------------- segments
@ApiTags('growth-segments')
@ApiBearerAuth()
@Controller({ path: 'segments', version: '1' })
export class SegmentsController {
  constructor(private readonly segments: SegmentsService) {}

  @Get()
  @RequirePermissions(Permission.MARKETING_VIEW)
  @ApiOperation({ summary: 'List customer segments.' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() q: PaginationDto) {
    const { items, total } = await this.segments.list(actor, q.page, q.pageSize, q.search);
    return { items, pagination: buildPaginationMeta(q.page, q.pageSize, total) };
  }

  @Post()
  @RequirePermissions(Permission.MARKETING_MANAGE)
  @ApiOperation({ summary: 'Create a customer segment.' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateSegmentDto) {
    return this.segments.create(actor, dto);
  }

  @Post('preview')
  @HttpCode(200)
  @RequirePermissions(Permission.MARKETING_VIEW)
  @ApiOperation({ summary: 'Preview unsaved segment rules (count + sample).' })
  async previewRules(@CurrentUser() actor: AuthPrincipal, @Body() dto: SegmentRulesBodyDto) {
    const { count, sample } = await this.segments.previewRules(actor.tenantId, dto.rules);
    return { count, sample };
  }

  @Get(':id')
  @RequirePermissions(Permission.MARKETING_VIEW)
  @ApiOperation({ summary: 'Get a segment.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.segments.get(actor, id);
  }

  @Post(':id/preview')
  @HttpCode(200)
  @RequirePermissions(Permission.MARKETING_VIEW)
  @ApiOperation({ summary: 'Preview a saved segment (count + sample); refreshes memberCount.' })
  async preview(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    const { count, sample } = await this.segments.previewSaved(actor, id);
    return { count, sample };
  }

  @Patch(':id')
  @RequirePermissions(Permission.MARKETING_MANAGE)
  @ApiOperation({ summary: 'Update a segment.' })
  update(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body() dto: UpdateSegmentDto) {
    return this.segments.update(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MARKETING_MANAGE)
  @ApiOperation({ summary: 'Soft-delete a segment.' })
  remove(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.segments.remove(actor, id);
  }
}

// ---------------------------------------------------------------- campaigns
@ApiTags('growth-campaigns')
@ApiBearerAuth()
@Controller({ path: 'campaigns', version: '1' })
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  @RequirePermissions(Permission.MARKETING_VIEW)
  @ApiOperation({ summary: 'List campaigns.' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() q: ListCampaignsDto) {
    const { items, total } = await this.campaigns.list(actor, q);
    return { items, pagination: buildPaginationMeta(q.page, q.pageSize, total) };
  }

  @Post()
  @RequirePermissions(Permission.MARKETING_MANAGE)
  @ApiOperation({ summary: 'Create a campaign (DRAFT, or SCHEDULED when scheduledAt is given).' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(actor, dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.MARKETING_VIEW)
  @ApiOperation({ summary: 'Get a campaign with stats.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.campaigns.get(actor, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.MARKETING_MANAGE)
  @ApiOperation({ summary: 'Update a DRAFT/SCHEDULED campaign.' })
  update(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaigns.update(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MARKETING_MANAGE)
  @ApiOperation({ summary: 'Soft-delete a campaign.' })
  remove(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.campaigns.remove(actor, id);
  }

  @Post(':id/schedule')
  @RequirePermissions(Permission.MARKETING_MANAGE)
  @ApiOperation({ summary: 'Schedule a campaign.' })
  schedule(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body() dto: ScheduleCampaignDto) {
    return this.campaigns.schedule(actor, id, dto.scheduledAt);
  }

  @Post(':id/send')
  @RequirePermissions(Permission.MARKETING_MANAGE)
  @ApiOperation({ summary: 'Send a campaign now (dispatches in the background).' })
  send(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.campaigns.sendNow(actor, id);
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.MARKETING_MANAGE)
  @ApiOperation({ summary: 'Cancel a scheduled or running campaign.' })
  cancel(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.campaigns.cancel(actor, id);
  }
}

// ------------------------------------------------------ analytics & loyalty
@ApiTags('growth-analytics')
@ApiBearerAuth()
@Controller({ path: 'growth', version: '1' })
export class GrowthAnalyticsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly loyalty: LoyaltyService,
  ) {}

  @Get('analytics/nps')
  @RequirePermissions(Permission.MARKETING_VIEW)
  @ApiOperation({ summary: 'NPS summary: promoters / passives / detractors and score.' })
  nps(@CurrentUser() actor: AuthPrincipal, @Query() q: NpsQueryDto) {
    return this.reviews.npsSummary(actor.tenantId, q.from, q.to);
  }

  @Get('loyalty/:customerId')
  @RequirePermissions(Permission.MARKETING_VIEW)
  @ApiOperation({ summary: "A customer's loyalty balance and ledger." })
  loyaltyStatement(@CurrentUser() actor: AuthPrincipal, @Param('customerId') customerId: string) {
    return this.loyalty.statement(actor.tenantId, customerId);
  }

  @Post('loyalty/:customerId/adjust')
  @RequirePermissions(Permission.MARKETING_MANAGE)
  @ApiOperation({ summary: 'Manually credit/debit loyalty points.' })
  async adjust(
    @CurrentUser() actor: AuthPrincipal,
    @Param('customerId') customerId: string,
    @Body() dto: AdjustLoyaltyDto,
  ) {
    await this.loyalty.statement(actor.tenantId, customerId); // 404 guard (tenant scoped)
    await this.loyalty.post({
      tenantId: actor.tenantId,
      customerId,
      points: dto.points,
      reason: dto.reason,
      refType: 'manual',
      refId: null,
    });
    return this.loyalty.statement(actor.tenantId, customerId);
  }
}

import type { AuthPrincipal } from '@ac/auth';
import { Permission } from '@ac/types';
import { Body, Controller, Get, HttpCode, NotFoundException, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CouponsService } from './coupons.service';
import { ValidateCouponDto } from './dto/coupon.dto';
import { ApplyReferralDto } from './dto/growth.dto';
import { LoyaltyService } from './loyalty.service';
import { ReferralsService } from './referrals.service';

/** Customer self-service growth endpoints (customer app). */
@ApiTags('me-growth')
@ApiBearerAuth()
@Controller({ path: 'me', version: '1' })
export class MeGrowthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coupons: CouponsService,
    private readonly referrals: ReferralsService,
    private readonly loyalty: LoyaltyService,
  ) {}

  private async customerId(actor: AuthPrincipal): Promise<string> {
    const c = await this.prisma.client.customer.findFirst({
      where: { userId: actor.userId, tenantId: actor.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Customer profile not found');
    return c.id;
  }

  @Post('coupons/validate')
  @HttpCode(200)
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Validate a coupon code for the signed-in customer.' })
  async validateCoupon(
    @CurrentUser() actor: AuthPrincipal,
    @Body() dto: ValidateCouponDto,
  ): Promise<{ valid: boolean; discountMinor: number; message?: string }> {
    const customerId = await this.customerId(actor);
    const r = await this.coupons.validate(actor.tenantId, customerId, dto.code, {
      category: dto.category,
      amountMinor: dto.amountMinor,
    });
    return { valid: r.valid, discountMinor: r.discountMinor, ...(r.message ? { message: r.message } : {}) };
  }

  @Get('referrals')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: "The customer's referral code, share link and referrals." })
  async myReferrals(@CurrentUser() actor: AuthPrincipal) {
    return this.referrals.summaryForCustomer(actor.tenantId, await this.customerId(actor));
  }

  @Post('referrals/apply')
  @HttpCode(200)
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: "Apply a friend's referral code (before the first completed booking)." })
  async applyReferral(@CurrentUser() actor: AuthPrincipal, @Body() dto: ApplyReferralDto) {
    return this.referrals.apply(actor.tenantId, await this.customerId(actor), dto.code);
  }

  @Get('loyalty')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: "The customer's loyalty balance and recent entries." })
  async myLoyalty(@CurrentUser() actor: AuthPrincipal) {
    return this.loyalty.statement(actor.tenantId, await this.customerId(actor), 50);
  }
}

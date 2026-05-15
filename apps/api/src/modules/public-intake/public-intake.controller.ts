import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { Public } from '../../common/decorators';
import { PublicLeadIntakeDto } from './dto/public-lead.dto';
import { PublicIntakeService } from './public-intake.service';

/**
 * Public, unauthenticated intake surface for the marketing site, WhatsApp
 * funnels and Google Ads landing pages. Heavy rate-limiting + honeypot.
 */
@ApiTags('public')
@Controller({ path: 'public', version: '1' })
export class PublicIntakeController {
  constructor(private readonly intake: PublicIntakeService) {}

  /**
   * Create a lead from the public website / landing pages.
   *
   * Rate limit: 5 requests per minute per IP (configurable via
   * `RATE_LIMIT_PUBLIC_LEAD_RPM`).
   */
  @Post('leads')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({
    default: {
      limit: Number(process.env['RATE_LIMIT_PUBLIC_LEAD_RPM'] ?? 5),
      ttl: 60_000,
    },
  })
  @ApiOperation({ summary: 'Public lead intake (unauthenticated).' })
  async createLead(
    @Body() dto: PublicLeadIntakeDto,
    @Req() req: FastifyRequest,
    @Headers('referer') referer?: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-ac-tenant') tenantSlug?: string,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? null;
    return this.intake.createLead(dto, {
      ip,
      userAgent: userAgent ?? null,
      referer: referer ?? null,
      tenantSlug: tenantSlug ?? null,
    });
  }

  /**
   * Public, cacheable "social-proof" counters used by the marketing
   * site. We deliberately keep the surface tight — only aggregate
   * counts, never customer-identifying data.
   */
  @Get('stats')
  @Public()
  @ApiOperation({ summary: 'Public marketing counters (cached).' })
  async stats(@Headers('x-ac-tenant') tenantSlug?: string) {
    return this.intake.publicStats(tenantSlug ?? null);
  }
}

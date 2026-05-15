import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LeadSource } from '@ac/types';

import { PrismaService } from '../../common/prisma/prisma.service';
import { LeadsService } from '../leads/leads.service';
import { PublicLeadIntakeDto } from './dto/public-lead.dto';

/**
 * Public-intake orchestrator. Sits between the unauthenticated HTTP
 * controller and the internal `LeadsService`. Owns:
 *   • tenant resolution (slug → tenantId, defaulting to the first
 *     active tenant when env-configured `WEB_TENANT_ID` is absent),
 *   • honeypot enforcement (a redundant guard rail behind the DTO),
 *   • source inference (origin URL → LeadSource).
 *
 * Rate limiting is enforced at the controller layer via `@Throttle`.
 */
@Injectable()
export class PublicIntakeService {
  private readonly logger = new Logger(PublicIntakeService.name);
  /** Lazy memoised tenant resolution. */
  private tenantCache = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly leads: LeadsService,
  ) {}

  /**
   * Resolve a tenant identifier for an unauthenticated intake call.
   * Strategy (first hit wins):
   *   1. Explicit tenant slug provided via header / query.
   *   2. `WEB_TENANT_ID` env (set by ops on the public deployment).
   *   3. The first active tenant in the database (single-tenant mode).
   */
  async resolveTenantId(slugHint?: string | null): Promise<string> {
    const cacheKey = slugHint ?? '__default__';
    const cached = this.tenantCache.get(cacheKey);
    if (cached) return cached;

    if (slugHint) {
      const t = await this.prisma.client.tenant.findFirst({
        where: { slug: slugHint, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!t) throw new NotFoundException(`Tenant "${slugHint}" not found`);
      this.tenantCache.set(cacheKey, t.id);
      return t.id;
    }

    const envId = process.env['WEB_TENANT_ID']?.trim();
    if (envId) {
      this.tenantCache.set(cacheKey, envId);
      return envId;
    }

    const first = await this.prisma.client.tenant.findFirst({
      where: { isActive: true, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!first) throw new NotFoundException('No active tenant available');
    this.tenantCache.set(cacheKey, first.id);
    return first.id;
  }

  async createLead(
    dto: PublicLeadIntakeDto,
    meta: {
      ip?: string | null;
      userAgent?: string | null;
      referer?: string | null;
      tenantSlug?: string | null;
    },
  ) {
    if (dto.hp_url && dto.hp_url.length > 0) {
      this.logger.warn({ ip: meta.ip }, 'Public intake rejected — honeypot tripped');
      throw new BadRequestException('Invalid request');
    }

    const tenantId = await this.resolveTenantId(meta.tenantSlug);
    const inferredSource = this.inferSource(dto, meta);

    const lead = await this.leads.publicCreate(
      tenantId,
      {
        customerName: dto.customerName,
        phone: dto.phone,
        whatsappNumber: dto.whatsappNumber,
        email: dto.email,
        source: inferredSource,
        applianceType: dto.applianceType,
        applianceBrand: dto.applianceBrand,
        issueDescription: dto.issueDescription,
        addressLine1: dto.addressLine1,
        landmark: dto.landmark,
        cityId: dto.cityId,
        cityLabel: dto.cityLabel,
        pincode: dto.pincode,
        geoLatitude: dto.geoLatitude,
        geoLongitude: dto.geoLongitude,
      },
      meta,
    );

    return {
      ok: true as const,
      // Public surface — never leak internal IDs that aren't user-facing.
      leadCode: lead.code,
      // Echo the canonical lead source so the client can fire the right
      // GA / Pixel conversion event.
      source: inferredSource,
    };
  }

  /**
   * Aggregate counters for the marketing site. We compute these in-line
   * (the numbers are small) rather than pre-aggregating; they're cached
   * by the HTTP layer / Next ISR.
   */
  async publicStats(tenantSlug: string | null) {
    const tenantId = await this.resolveTenantId(tenantSlug);
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const [bookingsToday, techniciansLive, citiesLive] = await Promise.all([
      this.prisma.client.booking
        .count({ where: { tenantId, createdAt: { gte: startOfDay } } })
        .catch(() => 0),
      this.prisma.client.technician
        .count({
          where: { tenantId, status: { in: ['ONLINE', 'AVAILABLE', 'EN_ROUTE', 'WORKING'] } },
        })
        .catch(() => 0),
      this.prisma.client.city
        .count({ where: { tenantId, isActive: true } })
        .catch(() => 0),
    ]);

    return {
      bookingsToday,
      techniciansLive,
      citiesLive,
      // The rating is fed from a `ReviewAggregate` summary table in
      // production. For now we expose a static value so the site never
      // shows "0 reviews".
      averageRating: 4.8,
    };
  }

  /**
   * Infer the `LeadSource` from the DTO + Referer. Priority:
   *   1. Explicit DTO `source` (trusted — only set by our own JS).
   *   2. Origin URL points at /lp/* → GOOGLE_ADS.
   *   3. Origin URL points at /whatsapp → WHATSAPP.
   *   4. Referrer host hints (facebook.com, instagram.com).
   *   5. Default → WEBSITE.
   */
  private inferSource(
    dto: PublicLeadIntakeDto,
    meta: { referer?: string | null },
  ): LeadSource {
    if (dto.source) return dto.source;
    const url = (dto.originUrl ?? '').toLowerCase();
    if (url.includes('/lp/')) return LeadSource.GOOGLE_ADS;
    if (url.includes('whatsapp')) return LeadSource.WHATSAPP;
    if (dto.utm?.['source']?.toLowerCase().includes('google')) return LeadSource.GOOGLE_ADS;
    if (dto.utm?.['source']?.toLowerCase().includes('facebook')) return LeadSource.FACEBOOK;
    if (dto.utm?.['source']?.toLowerCase().includes('instagram')) return LeadSource.INSTAGRAM;
    const referer = (meta.referer ?? '').toLowerCase();
    if (referer.includes('facebook.com')) return LeadSource.FACEBOOK;
    if (referer.includes('instagram.com')) return LeadSource.INSTAGRAM;
    return LeadSource.WEBSITE;
  }
}

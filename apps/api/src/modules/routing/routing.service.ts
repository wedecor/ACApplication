import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { PrismaService } from '../../common/prisma/prisma.service';
import { type LatLng, MAP_PROVIDER, type MapProvider, type RouteEstimateResult } from './routing.tokens';

const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes — fresh enough for dispatch
const COORD_PRECISION = 4; // ~11 m at the equator, enough to coalesce nearby reqs

/**
 * High-level routing facade. Wraps the configured MapProvider with a Postgres
 * cache so dispatch doesn't hammer Google / Mapbox on the unassigned-queue
 * page. Cache key collapses small co-ordinate jitter to keep hit-rate high.
 */
@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(
    @Inject(MAP_PROVIDER) private readonly provider: MapProvider,
    private readonly prisma: PrismaService,
  ) {}

  /** Force a fresh upstream call, ignoring cache. Used by the SLA monitor. */
  estimateFresh(origin: LatLng, destination: LatLng): Promise<RouteEstimateResult> {
    return this.provider.estimate(origin, destination);
  }

  async estimate(origin: LatLng, destination: LatLng): Promise<RouteEstimateResult> {
    const key = this.cacheKey(origin, destination, this.provider.name);
    const cached = await this.prisma.client.routeCache.findUnique({ where: { cacheKey: key } });
    if (cached && cached.expiresAt.getTime() > Date.now()) {
      return {
        distanceM: cached.distanceM,
        durationS: cached.durationS,
        trafficDurationS: cached.trafficDurationS,
        polyline: cached.polyline,
        provider: cached.provider as RouteEstimateResult['provider'],
      };
    }

    const estimate = await this.provider.estimate(origin, destination);
    // Best-effort cache write; never fail dispatch on cache writes.
    await this.prisma.client.routeCache
      .upsert({
        where: { cacheKey: key },
        create: {
          cacheKey: key,
          provider: estimate.provider,
          originLat: round(origin.latitude),
          originLng: round(origin.longitude),
          destLat: round(destination.latitude),
          destLng: round(destination.longitude),
          distanceM: estimate.distanceM,
          durationS: estimate.durationS,
          trafficDurationS: estimate.trafficDurationS,
          polyline: estimate.polyline,
          expiresAt: new Date(Date.now() + CACHE_TTL_MS),
        },
        update: {
          distanceM: estimate.distanceM,
          durationS: estimate.durationS,
          trafficDurationS: estimate.trafficDurationS,
          polyline: estimate.polyline,
          expiresAt: new Date(Date.now() + CACHE_TTL_MS),
        },
      })
      .catch((err) => this.logger.warn({ err }, 'route cache upsert failed'));

    return estimate;
  }

  /** Batch helper for dispatch recommendations (N origins → 1 destination). */
  async estimateMany(
    origins: LatLng[],
    destination: LatLng,
  ): Promise<RouteEstimateResult[]> {
    // Fan out sequentially with low concurrency to be polite to upstream APIs.
    const results: RouteEstimateResult[] = [];
    const CONCURRENCY = 4;
    for (let i = 0; i < origins.length; i += CONCURRENCY) {
      const slice = origins.slice(i, i + CONCURRENCY);
      const out = await Promise.all(slice.map((o) => this.estimate(o, destination)));
      results.push(...out);
    }
    return results;
  }

  /** Purge expired cache rows. Called from the SLA monitor cron. */
  async pruneExpired(): Promise<number> {
    const { count } = await this.prisma.client.routeCache.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return count;
  }

  private cacheKey(origin: LatLng, destination: LatLng, provider: string): string {
    const raw = `${provider}:${round(origin.latitude)}:${round(origin.longitude)}:${round(destination.latitude)}:${round(destination.longitude)}`;
    return createHash('sha1').update(raw).digest('hex');
  }
}

function round(n: number, precision = COORD_PRECISION): number {
  const f = 10 ** precision;
  return Math.round(n * f) / f;
}

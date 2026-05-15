import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  DomainEventName,
  type LiveTechnicianSnapshot,
  type TechnicianId,
  TechnicianStatus,
} from '@ac/types';
import type { Prisma } from '@ac/database';

import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { assertTenantMatch } from '../../common/tenant/tenant-scope';
import { RedisService } from '../../common/redis/redis.service';
import { LocationSigner } from './location-signer.service';
import { type LocationPingDto } from './dto/upload-location.dto';

/**
 * Redis key prefixes — kept short so SCAN / GEOSEARCH stay cheap at scale.
 *   - `live:geo:{tenantId}:{cityId}` Sorted-set / GEO index of techs in a city.
 *   - `live:tech:{technicianId}`     Hash of last-known properties for fast lookup.
 *
 * Hot paths (live-map, dispatch) only touch Redis. Postgres is the system of
 * record for history + recovery.
 */
const LIVE_GEO_KEY = (tenantId: string, cityId: string) => `live:geo:${tenantId}:${cityId}`;
const LIVE_TECH_KEY = (id: string) => `live:tech:${id}`;
const LIVE_TTL_SECONDS = 600;

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly events: DomainEventBus,
    private readonly signer: LocationSigner,
  ) {}

  /**
   * Ingest a batch of pings from a single technician device. Validates each
   * ping (signature + skew), writes the latest to Redis and Postgres, and
   * emits a single `technician.location_updated` event with the freshest
   * point so the realtime gateway can fan out a coalesced update.
   */
  async ingest(
    actorUserId: string,
    technicianId: string,
    pings: LocationPingDto[],
  ): Promise<{ accepted: number; rejected: number }> {
    if (pings.length === 0) return { accepted: 0, rejected: 0 };

    const tech = await this.prisma.client.technician.findFirst({
      where: { id: technicianId, deletedAt: null },
      select: {
        id: true,
        tenantId: true,
        cityId: true,
        userId: true,
        status: true,
        locationSignKey: true,
        deviceFingerprint: true,
      },
    });
    if (!tech) throw new NotFoundException('Technician not found');
    if (tech.userId !== actorUserId) {
      throw new ForbiddenException('Cannot upload location for another technician');
    }

    const valid: LocationPingDto[] = [];
    let rejected = 0;
    for (const ping of pings) {
      if (!this.signer.isFreshTimestamp(ping.recordedAt)) {
        rejected += 1;
        continue;
      }
      // Signature check is mandatory when the tech has a sign key provisioned.
      if (tech.locationSignKey && ping.signature && ping.deviceId) {
        const payload = LocationSigner.buildPayload({
          technicianId: tech.id,
          deviceId: ping.deviceId,
          latitude: ping.latitude,
          longitude: ping.longitude,
          recordedAt: ping.recordedAt,
        });
        if (!this.signer.verify(tech.locationSignKey, payload, ping.signature)) {
          rejected += 1;
          continue;
        }
      }
      // Device fingerprint guard — if registered, every ping must match.
      if (tech.deviceFingerprint && ping.deviceId && ping.deviceId !== tech.deviceFingerprint) {
        rejected += 1;
        continue;
      }
      valid.push(ping);
    }

    if (valid.length === 0) return { accepted: 0, rejected };

    // Sort by recordedAt to pick the freshest as the "current" point.
    valid.sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
    const latest = valid[valid.length - 1]!;

    // History: bulk-insert with createMany; skip duplicates if any.
    await this.prisma.client.technicianLocation.createMany({
      data: valid.map<Prisma.TechnicianLocationCreateManyInput>((p) => ({
        tenantId: tech.tenantId,
        technicianId: tech.id,
        latitude: p.latitude,
        longitude: p.longitude,
        accuracyM: p.accuracyM ?? null,
        heading: p.heading ?? null,
        speedMps: p.speedMps ?? null,
        altitudeM: p.altitudeM ?? null,
        batteryPct: p.batteryPct ?? null,
        isBackground: p.isBackground ?? false,
        wasOffline: p.wasOffline ?? false,
        signature: p.signature ?? null,
        deviceId: p.deviceId ?? null,
        source: p.source ?? null,
        recordedAt: new Date(p.recordedAt),
      })),
    });

    // Denormalised "last position" columns + lastSeenAt.
    await this.prisma.client.technician.update({
      where: { id: tech.id },
      data: {
        lastLatitude: latest.latitude,
        lastLongitude: latest.longitude,
        lastHeading: latest.heading ?? null,
        lastSpeedMps: latest.speedMps ?? null,
        lastAccuracyM: latest.accuracyM ?? null,
        lastBatteryPct: latest.batteryPct ?? null,
        lastLocationAt: new Date(latest.recordedAt),
        lastSeenAt: new Date(),
      },
    });

    // Redis live cache — use the geo index for city-wide nearest queries.
    await Promise.all([
      this.redis.default.geoadd(
        LIVE_GEO_KEY(tech.tenantId, tech.cityId),
        latest.longitude,
        latest.latitude,
        tech.id,
      ),
      this.redis.default
        .multi()
        .hset(LIVE_TECH_KEY(tech.id), {
          tenantId: tech.tenantId,
          cityId: tech.cityId,
          status: tech.status,
          lat: String(latest.latitude),
          lng: String(latest.longitude),
          heading: String(latest.heading ?? ''),
          speedMps: String(latest.speedMps ?? ''),
          batteryPct: String(latest.batteryPct ?? ''),
          recordedAt: latest.recordedAt,
        })
        .expire(LIVE_TECH_KEY(tech.id), LIVE_TTL_SECONDS)
        .exec(),
    ]).catch((err) => this.logger.warn({ err }, 'Redis live cache write failed'));

    this.events.publish(DomainEventName.TechnicianLocationUpdated, {
      technicianId: tech.id as TechnicianId,
      location: { latitude: latest.latitude, longitude: latest.longitude },
      recordedAt: latest.recordedAt,
    });

    return { accepted: valid.length, rejected };
  }

  /**
   * Live-map snapshot for the admin CRM. Reads from the denormalised columns
   * on Technician — fast, indexable, and includes inactive techs (greyed-out
   * markers help dispatchers see who's off-shift).
   */
  async liveMap(
    tenantId: string,
    options: { cityId?: string; statuses?: TechnicianStatus[] } = {},
  ): Promise<LiveTechnicianSnapshot[]> {
    const technicians = await this.prisma.client.technician.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(options.cityId ? { cityId: options.cityId } : {}),
        ...(options.statuses?.length ? { status: { in: options.statuses } } : {}),
      },
      include: {
        bookings: {
          where: {
            status: { in: ['ASSIGNED', 'TECHNICIAN_EN_ROUTE', 'IN_PROGRESS', 'WAITING_PARTS'] },
            deletedAt: null,
          },
          orderBy: { scheduledAt: 'asc' },
          take: 1,
          select: { id: true, code: true },
        },
        _count: {
          select: {
            bookings: {
              where: {
                status: { in: ['ASSIGNED', 'TECHNICIAN_EN_ROUTE', 'IN_PROGRESS', 'WAITING_PARTS'] },
                deletedAt: null,
              },
            },
          },
        },
      },
    });

    return technicians.map<LiveTechnicianSnapshot>((t) => ({
      technicianId: t.id as TechnicianId,
      fullName: t.fullName,
      cityId: t.cityId as never,
      status: t.status as TechnicianStatus,
      rating: t.rating,
      activeJobs: t._count.bookings,
      latitude: t.lastLatitude,
      longitude: t.lastLongitude,
      heading: t.lastHeading,
      speedMps: t.lastSpeedMps,
      batteryPct: t.lastBatteryPct,
      lastSeenAt: t.lastSeenAt?.toISOString() ?? null,
      lastLocationAt: t.lastLocationAt?.toISOString() ?? null,
      activeBookingId: (t.bookings[0]?.id as never) ?? null,
      activeBookingCode: t.bookings[0]?.code ?? null,
    }));
  }

  /**
   * Redis GEOSEARCH — returns technicians within `radiusKm` of (lat, lng)
   * inside a city. Used by the dispatch engine as a fast pre-filter before
   * scoring.
   */
  async nearestTechnicians(
    tenantId: string,
    cityId: string,
    point: { latitude: number; longitude: number },
    radiusKm: number,
    limit = 20,
  ): Promise<Array<{ technicianId: string; distanceKm: number }>> {
    try {
      const raw = (await this.redis.default.call(
        'GEOSEARCH',
        LIVE_GEO_KEY(tenantId, cityId),
        'FROMLONLAT',
        String(point.longitude),
        String(point.latitude),
        'BYRADIUS',
        String(radiusKm),
        'km',
        'ASC',
        'COUNT',
        String(limit),
        'WITHDIST',
      )) as Array<[string, string]>;
      return raw.map(([id, dist]) => ({ technicianId: id, distanceKm: Number(dist) }));
    } catch (err) {
      this.logger.warn({ err }, 'GEOSEARCH failed — caller should fall back to DB query');
      return [];
    }
  }

  async history(tenantId: string, technicianId: string, since: Date, limit = 1000) {
    const tech = await this.prisma.client.technician.findFirst({
      where: { id: technicianId, deletedAt: null },
      select: { id: true, tenantId: true },
    });
    assertTenantMatch(tech, tenantId, 'Technician');

    return this.prisma.client.technicianLocation.findMany({
      where: { technicianId, recordedAt: { gte: since } },
      orderBy: { recordedAt: 'asc' },
      take: limit,
    });
  }

  /** Inserted as part of the boot flow when a technician comes online. */
  async writeBootstrapPing(
    technicianId: string,
    location: { latitude: number; longitude: number },
  ): Promise<void> {
    const tech = await this.prisma.client.technician.findUnique({
      where: { id: technicianId },
      select: { id: true, tenantId: true, cityId: true },
    });
    if (!tech) return;
    await Promise.all([
      this.redis.default.geoadd(
        LIVE_GEO_KEY(tech.tenantId, tech.cityId),
        location.longitude,
        location.latitude,
        tech.id,
      ),
      this.prisma.client.technician.update({
        where: { id: tech.id },
        data: {
          lastLatitude: location.latitude,
          lastLongitude: location.longitude,
          lastLocationAt: new Date(),
          lastSeenAt: new Date(),
        },
      }),
    ]).catch((err) => this.logger.warn({ err }, 'bootstrap ping failed'));
  }
}

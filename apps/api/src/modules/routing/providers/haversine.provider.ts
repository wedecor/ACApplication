import { Injectable } from '@nestjs/common';

import { type LatLng, type MapProvider, type RouteEstimateResult } from '../routing.tokens';

/**
 * Zero-dependency great-circle distance + a constant urban-speed model
 * (28 km/h ≈ Bengaluru median). Cheap, deterministic, always available.
 * Use as a safety net when external providers are unconfigured or rate-limited.
 */
@Injectable()
export class HaversineMapProvider implements MapProvider {
  readonly name = 'haversine' as const;
  private readonly URBAN_SPEED_MPS = 28_000 / 3600;

  async estimate(origin: LatLng, destination: LatLng): Promise<RouteEstimateResult> {
    const distanceM = Math.round(this.haversineMeters(origin, destination));
    const durationS = Math.max(60, Math.round(distanceM / this.URBAN_SPEED_MPS));
    return {
      distanceM,
      durationS,
      trafficDurationS: null,
      polyline: null,
      provider: this.name,
    };
  }

  private haversineMeters(a: LatLng, b: LatLng): number {
    const R = 6371e3;
    const toRad = (n: number) => (n * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h =
      Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }
}

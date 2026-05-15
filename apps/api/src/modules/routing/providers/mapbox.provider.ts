import { Injectable, Logger } from '@nestjs/common';

import { HaversineMapProvider } from './haversine.provider';
import { type LatLng, type MapProvider, type RouteEstimateResult } from '../routing.tokens';

/**
 * Mapbox Directions adapter. Same contract as the Google adapter — falls
 * back to Haversine on any error.
 */
@Injectable()
export class MapboxProvider implements MapProvider {
  readonly name = 'mapbox' as const;
  private readonly logger = new Logger(MapboxProvider.name);
  private readonly TIMEOUT_MS = 4_000;

  constructor(private readonly haversine: HaversineMapProvider) {}

  async estimate(origin: LatLng, destination: LatLng): Promise<RouteEstimateResult> {
    const token = process.env['MAPBOX_TOKEN'];
    if (!token) return this.haversine.estimate(origin, destination);

    const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}`);
    url.searchParams.set('overview', 'full');
    url.searchParams.set('geometries', 'polyline');
    url.searchParams.set('access_token', token);

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ac.signal });
      const json = (await res.json()) as {
        code?: string;
        routes?: Array<{ distance: number; duration: number; geometry?: string }>;
      };
      const route = json.routes?.[0];
      if (json.code !== 'Ok' || !route) {
        throw new Error(`mapbox code=${json.code ?? 'missing'}`);
      }
      return {
        distanceM: Math.round(route.distance),
        durationS: Math.round(route.duration),
        trafficDurationS: Math.round(route.duration),
        polyline: route.geometry ?? null,
        provider: this.name,
      };
    } catch (err) {
      this.logger.warn({ err }, 'Mapbox estimate failed — falling back to Haversine');
      return this.haversine.estimate(origin, destination);
    } finally {
      clearTimeout(timer);
    }
  }
}

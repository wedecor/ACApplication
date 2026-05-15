import { Injectable, Logger } from '@nestjs/common';

import { HaversineMapProvider } from './haversine.provider';
import { type LatLng, type MapProvider, type RouteEstimateResult } from '../routing.tokens';

/**
 * Google Distance Matrix adapter. Falls back to Haversine when:
 *   - no API key is configured (so dev / CI still works),
 *   - the upstream call fails or times out,
 *   - the response is partial / malformed.
 *
 * Single-leg only — multi-stop is a future evolution.
 */
@Injectable()
export class GoogleMapsProvider implements MapProvider {
  readonly name = 'google' as const;
  private readonly logger = new Logger(GoogleMapsProvider.name);
  private readonly TIMEOUT_MS = 4_000;

  constructor(private readonly haversine: HaversineMapProvider) {}

  async estimate(origin: LatLng, destination: LatLng): Promise<RouteEstimateResult> {
    const apiKey = process.env['GOOGLE_MAPS_API_KEY'];
    if (!apiKey) return this.haversine.estimate(origin, destination);

    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.set('origins', `${origin.latitude},${origin.longitude}`);
    url.searchParams.set('destinations', `${destination.latitude},${destination.longitude}`);
    url.searchParams.set('departure_time', 'now');
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('key', apiKey);

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ac.signal });
      const json = (await res.json()) as {
        status: string;
        rows?: Array<{
          elements?: Array<{
            status: string;
            distance?: { value: number };
            duration?: { value: number };
            duration_in_traffic?: { value: number };
          }>;
        }>;
      };
      const elem = json.rows?.[0]?.elements?.[0];
      if (json.status !== 'OK' || !elem || elem.status !== 'OK' || !elem.distance || !elem.duration) {
        throw new Error(`google status=${json.status} elem=${elem?.status ?? 'missing'}`);
      }
      return {
        distanceM: elem.distance.value,
        durationS: elem.duration.value,
        trafficDurationS: elem.duration_in_traffic?.value ?? null,
        polyline: null,
        provider: this.name,
      };
    } catch (err) {
      this.logger.warn({ err }, 'Google estimate failed — falling back to Haversine');
      return this.haversine.estimate(origin, destination);
    } finally {
      clearTimeout(timer);
    }
  }
}

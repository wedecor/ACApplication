export const MAP_PROVIDER = Symbol('AC_MAP_PROVIDER');

/** A 2D geo point — kept narrow on purpose. */
export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteEstimateResult {
  distanceM: number;
  durationS: number;
  /** Traffic-adjusted duration (Google `duration_in_traffic`). */
  trafficDurationS: number | null;
  /** Encoded polyline (compatible with Google's algorithm). */
  polyline: string | null;
  provider: 'haversine' | 'google' | 'mapbox';
}

/**
 * Map-provider adapter contract. Implementations MUST be:
 *   - pure & side-effect free at construction time,
 *   - resilient to network errors (return a fallback ETA),
 *   - quick to fail (≤ 5s).
 */
export interface MapProvider {
  /** Identifier — appears in the RouteCache rows. */
  readonly name: 'haversine' | 'google' | 'mapbox';
  estimate(origin: LatLng, destination: LatLng): Promise<RouteEstimateResult>;
}

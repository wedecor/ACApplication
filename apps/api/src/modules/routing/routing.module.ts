import { Global, Module } from '@nestjs/common';

import { GoogleMapsProvider } from './providers/google-maps.provider';
import { HaversineMapProvider } from './providers/haversine.provider';
import { MapboxProvider } from './providers/mapbox.provider';
import { MAP_PROVIDER } from './routing.tokens';
import { RoutingService } from './routing.service';

/**
 * Routing module — chooses a map provider based on env, exposes a typed
 * `RoutingService` that all dispatch / ETA code consumes. Adapters share the
 * same `MapProvider` interface so swapping Haversine → Google → Mapbox is a
 * one-line change in `MAP_PROVIDER`.
 *
 * @Global so feature modules (Dispatch, SLA monitor, controllers) don't have
 * to re-import it every time.
 */
@Global()
@Module({
  providers: [
    HaversineMapProvider,
    GoogleMapsProvider,
    MapboxProvider,
    {
      provide: MAP_PROVIDER,
      // Resolution order: Google key → Mapbox key → Haversine fallback. This
      // lets dev / CI run without external keys but stays prod-ready.
      useFactory: (
        haversine: HaversineMapProvider,
        google: GoogleMapsProvider,
        mapbox: MapboxProvider,
      ) => {
        if (process.env['GOOGLE_MAPS_API_KEY']) return google;
        if (process.env['MAPBOX_TOKEN']) return mapbox;
        return haversine;
      },
      inject: [HaversineMapProvider, GoogleMapsProvider, MapboxProvider],
    },
    RoutingService,
  ],
  exports: [RoutingService, MAP_PROVIDER],
})
export class RoutingModule {}

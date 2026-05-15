import { Module } from '@nestjs/common';

import { LocationSigner } from './location-signer.service';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';

/**
 * Live-tracking domain. Owns location ingestion, the Redis live-map cache and
 * historical persistence. Read paths fan out from here to the live-map and
 * dispatch services.
 */
@Module({
  controllers: [TrackingController],
  providers: [TrackingService, LocationSigner],
  exports: [TrackingService],
})
export class TrackingModule {}

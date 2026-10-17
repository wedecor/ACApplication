import { Module } from '@nestjs/common';

import { StorageService } from './storage.service';

/**
 * Reusable S3-compatible storage (presigned uploads / downloads). Import
 * wherever a feature needs to hand clients a direct-upload URL.
 */
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}

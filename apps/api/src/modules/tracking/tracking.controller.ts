import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Permission, TechnicianStatus } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { UploadLocationDto } from './dto/upload-location.dto';
import { TrackingService } from './tracking.service';

/**
 * Tracking endpoints.
 *
 *   - `POST /technicians/:id/location` (ingest, signed) — heavy throttle.
 *   - `GET  /technicians/:id/history`  — admins only.
 *   - `GET  /technicians/live-map`     — dispatcher control center.
 */
@ApiTags('tracking')
@ApiBearerAuth()
@Controller({ path: 'technicians', version: '1' })
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  // 60 rps per IP is generous for a tech app that uploads in 30s batches.
  @Throttle({ global: { limit: 60, ttl: 1000 } })
  @Post(':id/location')
  @RequirePermissions(Permission.TECHNICIAN_LOCATION_WRITE)
  @ApiOperation({ summary: 'Upload one or more GPS pings (offline-queue safe).' })
  upload(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') technicianId: string,
    @Body() dto: UploadLocationDto,
  ) {
    return this.tracking.ingest(actor.userId, technicianId, dto.pings);
  }

  @Get('live-map')
  @RequirePermissions(Permission.TECHNICIAN_TRACK)
  @ApiOperation({ summary: 'Live-map snapshot — denormalised, includes active jobs.' })
  liveMap(
    @CurrentUser() actor: AuthPrincipal,
    @Query('cityId') cityId?: string,
    @Query('status') statusCsv?: string,
  ) {
    const statuses = statusCsv?.split(',').filter((s): s is TechnicianStatus =>
      Object.values(TechnicianStatus).includes(s as TechnicianStatus),
    );
    return this.tracking.liveMap(actor.tenantId, { cityId, statuses });
  }

  @Get(':id/history')
  @RequirePermissions(Permission.TECHNICIAN_TRACK)
  @ApiOperation({ summary: 'Replay GPS history for a technician.' })
  history(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') technicianId: string,
    @Query('sinceMinutes') sinceMinutesRaw?: string,
  ) {
    const minutes = Math.min(60 * 24, Math.max(5, Number(sinceMinutesRaw ?? 120)));
    const since = new Date(Date.now() - minutes * 60_000);
    return this.tracking.history(actor.tenantId, technicianId, since);
  }
}

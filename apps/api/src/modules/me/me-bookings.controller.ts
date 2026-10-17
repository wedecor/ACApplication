import type { AuthPrincipal } from '@ac/auth';
import { Permission } from '@ac/types';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import {
  AddMyBookingNoteDto,
  AddMyBookingPhotosDto,
  CancelMyBookingDto,
  CreateMyBookingDto,
  EstimateDto,
  ListMyBookingsDto,
  MyBookingComplaintDto,
  RateMyBookingDto,
  RescheduleMyBookingDto,
  SlotsQueryDto,
} from './dto/me-bookings.dto';
import { MeBookingsService } from './me-bookings.service';

/**
 * Customer self-service bookings. Every route resolves the caller's
 * Customer row and scopes queries by it — a customer can never see or
 * mutate another customer's booking.
 */
@ApiTags('me:bookings')
@ApiBearerAuth()
@Controller({ path: 'me/bookings', version: '1' })
export class MeBookingsController {
  constructor(private readonly svc: MeBookingsService) {}

  @Get()
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'List my bookings (status: active | completed | cancelled).' })
  list(@CurrentUser() actor: AuthPrincipal, @Query() query: ListMyBookingsDto) {
    return this.svc.list(actor, query);
  }

  @Post('estimate')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Price estimate for a category / issue from the service catalog.' })
  estimate(@CurrentUser() actor: AuthPrincipal, @Body() dto: EstimateDto) {
    return this.svc.estimate(actor, dto);
  }

  @Get('slots')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Bookable time windows for a date, from technician capacity in the city.' })
  slots(@CurrentUser() actor: AuthPrincipal, @Query() query: SlotsQueryDto) {
    return this.svc.slots(actor, query);
  }

  @Post()
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Create a booking for myself.' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateMyBookingDto) {
    return this.svc.create(actor, dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'My booking detail with timeline, photos, rating and invoice id.' })
  detail(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.svc.detail(actor, id);
  }

  @Patch(':id/reschedule')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Reschedule my booking (before the technician is en route).' })
  reschedule(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: RescheduleMyBookingDto,
  ) {
    return this.svc.reschedule(actor, id, dto);
  }

  @Patch(':id/cancel')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Cancel my booking (before the technician is en route).' })
  cancel(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body() dto: CancelMyBookingDto) {
    return this.svc.cancel(actor, id, dto);
  }

  @Post(':id/notes')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Add a customer-visible note to my booking.' })
  addNote(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body() dto: AddMyBookingNoteDto) {
    return this.svc.addNote(actor, id, dto);
  }

  @Post(':id/photos')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Attach uploaded photos to my booking.' })
  addPhotos(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: AddMyBookingPhotosDto,
  ) {
    return this.svc.addPhotos(actor, id, dto);
  }

  @Post(':id/rating')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Rate a completed booking (once).' })
  rate(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body() dto: RateMyBookingDto) {
    return this.svc.rate(actor, id, dto);
  }

  @Post(':id/complaint')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Raise a complaint on my booking — opens a support ticket.' })
  complaint(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: MyBookingComplaintDto,
  ) {
    return this.svc.complaint(actor, id, dto);
  }

  @Get(':id/technician/location')
  @RequirePermissions(Permission.SELF_SERVICE)
  @ApiOperation({ summary: 'Live technician location while the job is active (null otherwise).' })
  location(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.svc.technicianLocation(actor, id);
  }
}

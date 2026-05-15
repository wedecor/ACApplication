import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import { AddBookingAttachmentDto, AddSignatureDto } from './dto/booking-attachment.dto';
import { AddBookingNoteDto } from './dto/booking-note.dto';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { ChangeBookingStatusDto } from './dto/change-booking-status.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsDto } from './dto/list-bookings.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { VerifyBookingOtpDto } from './dto/verify-otp.dto';
import { BookingsService } from './bookings.service';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller({ path: 'bookings', version: '1' })
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  @RequirePermissions(Permission.BOOKING_CREATE)
  @ApiOperation({ summary: 'Create a booking (optionally linked to a lead).' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateBookingDto) {
    return this.bookings.create(actor, dto);
  }

  @Post('from-lead/:leadId')
  @RequirePermissions(Permission.BOOKING_CREATE, Permission.LEAD_UPDATE)
  @ApiOperation({ summary: 'Convert a lead into a booking (atomic).' })
  createFromLead(
    @CurrentUser() actor: AuthPrincipal,
    @Param('leadId') leadId: string,
    @Body() dto: ConvertLeadDto,
  ) {
    return this.bookings.createFromLead(actor, leadId, dto);
  }

  @Get()
  @RequirePermissions(Permission.BOOKING_READ)
  async list(@CurrentUser() actor: AuthPrincipal, @Query() query: ListBookingsDto) {
    const { items, total } = await this.bookings.list(actor, query);
    return {
      items,
      pagination: buildPaginationMeta(query.page, query.pageSize, total),
    };
  }

  @Get(':id')
  @RequirePermissions(Permission.BOOKING_READ)
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.bookings.getById(actor, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.BOOKING_UPDATE)
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
  ) {
    return this.bookings.update(actor, id, dto);
  }

  @Post(':id/assign-technician')
  @RequirePermissions(Permission.BOOKING_ASSIGN)
  @ApiOperation({ summary: 'Assign or auto-assign a technician.' })
  assignTechnician(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: AssignTechnicianDto,
  ) {
    return this.bookings.assignTechnician(actor, id, dto);
  }

  @Post(':id/status')
  @RequirePermissions(Permission.BOOKING_UPDATE)
  @ApiOperation({ summary: 'Change booking status (state-machine guarded).' })
  changeStatus(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: ChangeBookingStatusDto,
  ) {
    return this.bookings.changeStatus(actor, id, dto);
  }

  @Post(':id/reschedule')
  @RequirePermissions(Permission.BOOKING_RESCHEDULE)
  reschedule(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: RescheduleBookingDto,
  ) {
    return this.bookings.reschedule(actor, id, dto);
  }

  @Post(':id/otp/send')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(Permission.BOOKING_UPDATE)
  @ApiOperation({ summary: 'Issue an arrival OTP to the customer.' })
  sendOtp(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.bookings.sendArrivalOtp(actor, id);
  }

  @Post(':id/verify-otp')
  @RequirePermissions(Permission.BOOKING_UPDATE)
  @ApiOperation({ summary: 'Verify arrival OTP and start the job.' })
  verifyOtp(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: VerifyBookingOtpDto,
  ) {
    return this.bookings.verifyArrivalOtp(actor, id, dto);
  }

  @Post(':id/notes')
  @RequirePermissions(Permission.BOOKING_UPDATE)
  addNote(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: AddBookingNoteDto,
  ) {
    return this.bookings.addNote(actor, id, dto);
  }

  @Get(':id/notes')
  @RequirePermissions(Permission.BOOKING_READ)
  listNotes(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.bookings.listNotes(actor, id);
  }

  @Post(':id/attachments')
  @RequirePermissions(Permission.BOOKING_UPDATE)
  addAttachment(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: AddBookingAttachmentDto,
  ) {
    return this.bookings.addAttachment(actor, id, dto);
  }

  @Get(':id/attachments')
  @RequirePermissions(Permission.BOOKING_READ)
  listAttachments(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.bookings.listAttachments(actor, id);
  }

  @Post(':id/signature')
  @RequirePermissions(Permission.BOOKING_UPDATE)
  setSignature(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: AddSignatureDto,
  ) {
    return this.bookings.setSignature(actor, id, dto);
  }

  @Get(':id/activities')
  @RequirePermissions(Permission.BOOKING_READ)
  listActivities(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.bookings.listActivities(actor, id);
  }
}

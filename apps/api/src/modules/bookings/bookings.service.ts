import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityType,
  BookingPaymentStatus,
  BookingStatus,
  canTransitionBooking,
  DomainEventName,
  type BookingId,
  type LeadId,
  type TechnicianId,
  type ServiceCategory,
  TERMINAL_BOOKING_STATUSES,
} from '@ac/types';
import { otp } from '@ac/auth';
import type { AuthPrincipal } from '@ac/auth';

import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { AssignmentService } from '../assignment/assignment.service';
import { LeadsRepository } from '../leads/leads.repository';
import { AddBookingNoteDto } from './dto/booking-note.dto';
import { AddBookingAttachmentDto, AddSignatureDto } from './dto/booking-attachment.dto';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { ChangeBookingStatusDto } from './dto/change-booking-status.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsDto } from './dto/list-bookings.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { VerifyBookingOtpDto } from './dto/verify-otp.dto';
import { BookingsRepository } from './bookings.repository';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class BookingsService {
  constructor(
    private readonly repo: BookingsRepository,
    private readonly leads: LeadsRepository,
    private readonly assignment: AssignmentService,
    private readonly activity: ActivityService,
    private readonly events: DomainEventBus,
    private readonly prisma: PrismaService,
  ) {}

  async create(actor: AuthPrincipal, dto: CreateBookingDto) {
    if (new Date(dto.scheduledAt) < new Date(Date.now() - 60 * 1000)) {
      throw new BadRequestException('scheduledAt must not be in the past');
    }

    // Customer + city resolved against the same tenant.
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: dto.customerId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    // Either reuse an existing address (verify ownership) or create one from snapshot.
    let addressId = dto.addressId;
    if (addressId) {
      const owned = await this.prisma.client.address.findFirst({
        where: { id: addressId, customerId: dto.customerId },
        select: { id: true },
      });
      if (!owned) throw new BadRequestException('addressId does not belong to customer');
    } else {
      const created = await this.prisma.client.address.create({
        data: {
          customerId: dto.customerId,
          line1: dto.address.line1,
          line2: dto.address.line2 ?? null,
          landmark: dto.address.landmark ?? null,
          city: dto.address.city,
          state: dto.address.state,
          pincode: dto.address.pincode,
          country: dto.address.country ?? 'IN',
          latitude: dto.geoLatitude ?? null,
          longitude: dto.geoLongitude ?? null,
        },
      });
      addressId = created.id;
    }

    const code = await this.repo.nextCode(actor.tenantId);

    const booking = await this.prisma.client.$transaction(async (tx) => {
      const row = await this.repo.create(
        {
          code,
          tenantId: actor.tenantId,
          customer: { connect: { id: dto.customerId } },
          city: { connect: { id: dto.cityId } },
          address: { connect: { id: addressId! } },
          category: dto.category,
          serviceType: dto.serviceType ?? null,
          applianceBrand: dto.applianceBrand ?? null,
          applianceType: dto.applianceType ?? null,
          issueDescription: dto.issueDescription ?? null,
          status: BookingStatus.PENDING,
          paymentStatus: BookingPaymentStatus.UNPAID,
          priority: dto.priority ?? 'STANDARD',
          scheduledAt: new Date(dto.scheduledAt),
          scheduledTimeSlot: dto.scheduledTimeSlot ?? null,
          estimatedAmountMinor: dto.estimatedAmountMinor ?? 0,
          addressSnapshot: { ...dto.address } as never,
          geoLatitude: dto.geoLatitude ?? null,
          geoLongitude: dto.geoLongitude ?? null,
          notes: dto.notes ?? null,
          ...(dto.leadId ? { lead: { connect: { id: dto.leadId } } } : {}),
          createdBy: actor.userId,
          updatedBy: actor.userId,
        },
        tx,
      );

      await this.activity.recordBookingActivity(
        row.id,
        {
          tenantId: actor.tenantId,
          type: ActivityType.CREATED,
          actorUserId: actor.userId,
          toStatus: row.status,
          message: `Booking ${row.code} created`,
          metadata: { code: row.code },
        },
        tx,
      );
      return row;
    });

    this.events.publish(DomainEventName.BookingCreated, {
      bookingId: booking.id as BookingId,
      customerId: booking.customerId as never,
    });

    return this.repo.findById(actor.tenantId, booking.id);
  }

  /**
   * Atomic lead → booking conversion. Updates the lead's status to
   * BOOKING_CREATED and stamps `bookingId` so the link survives migrations.
   */
  async createFromLead(actor: AuthPrincipal, leadId: string, dto: ConvertLeadDto) {
    const lead = await this.leads.findById(actor.tenantId, leadId);
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.bookingId) {
      throw new ConflictException({ message: 'Lead already has a booking', bookingId: lead.bookingId });
    }
    if (lead.status === 'CANCELLED' || lead.status === 'SPAM') {
      throw new ForbiddenException('Lead is closed');
    }

    const booking = await this.create(actor, { ...dto.booking, leadId });
    if (!booking) throw new BadRequestException('Failed to create booking');

    await this.prisma.client.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: leadId },
        data: {
          status: 'BOOKING_CREATED',
          bookingId: booking.id,
          convertedAt: new Date(),
          closedAt: new Date(),
          updatedBy: actor.userId,
        },
      });
      await this.activity.recordLeadActivity(
        leadId,
        {
          tenantId: actor.tenantId,
          type: ActivityType.CONVERTED_TO_BOOKING,
          actorUserId: actor.userId,
          fromStatus: lead.status,
          toStatus: 'BOOKING_CREATED',
          message: `Converted to ${booking.code}`,
          metadata: { bookingId: booking.id, bookingCode: booking.code },
        },
        tx,
      );
    });

    this.events.publish(DomainEventName.LeadConverted, {
      leadId: leadId as LeadId,
      bookingId: booking.id as BookingId,
    });

    return booking;
  }

  list(actor: AuthPrincipal, query: ListBookingsDto) {
    return this.repo.list(actor.tenantId, query);
  }

  async getById(actor: AuthPrincipal, id: string) {
    const booking = await this.repo.findById(actor.tenantId, id);
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateBookingDto) {
    const booking = await this.getById(actor, id);
    if (TERMINAL_BOOKING_STATUSES.has(booking.status as BookingStatus)) {
      throw new ForbiddenException('Booking is closed and cannot be edited');
    }

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const row = await this.repo.update(
        id,
        {
          ...(dto.category ? { category: dto.category } : {}),
          serviceType: dto.serviceType ?? undefined,
          applianceBrand: dto.applianceBrand ?? undefined,
          applianceType: dto.applianceType ?? undefined,
          issueDescription: dto.issueDescription ?? undefined,
          priority: dto.priority ?? undefined,
          estimatedAmountMinor: dto.estimatedAmountMinor ?? undefined,
          scheduledTimeSlot: dto.scheduledTimeSlot ?? undefined,
          notes: dto.notes ?? undefined,
          geoLatitude: dto.geoLatitude ?? undefined,
          geoLongitude: dto.geoLongitude ?? undefined,
          ...(dto.scheduledAt ? { scheduledAt: new Date(dto.scheduledAt) } : {}),
          updatedBy: actor.userId,
        },
        tx,
      );
      await this.activity.recordBookingActivity(
        id,
        {
          tenantId: actor.tenantId,
          type: ActivityType.FIELD_UPDATED,
          actorUserId: actor.userId,
          message: 'Booking fields updated',
          metadata: { changed: dto as unknown as Record<string, unknown> },
        },
        tx,
      );
      return row;
    });

    return updated;
  }

  async assignTechnician(actor: AuthPrincipal, id: string, dto: AssignTechnicianDto) {
    const booking = await this.getById(actor, id);
    if (TERMINAL_BOOKING_STATUSES.has(booking.status as BookingStatus)) {
      throw new ForbiddenException('Cannot assign a closed booking');
    }

    let technicianId = dto.technicianId;
    if (!technicianId) {
      if (!dto.autoPick) throw new BadRequestException('technicianId or autoPick is required');
      const best = await this.assignment.pickBest({
        tenantId: actor.tenantId,
        cityId: booking.cityId,
        category: booking.category as ServiceCategory,
        geo:
          booking.geoLatitude != null && booking.geoLongitude != null
            ? { latitude: booking.geoLatitude, longitude: booking.geoLongitude }
            : null,
        scheduledAt: booking.scheduledAt,
      });
      if (!best) {
        throw new ConflictException({
          message: 'No suitable technician available. Dispatcher review required.',
          code: 'NO_TECHNICIAN_AVAILABLE',
        });
      }
      technicianId = best.technician.id;
    } else {
      const tech = await this.prisma.client.technician.findFirst({
        where: { id: technicianId, tenantId: actor.tenantId, cityId: booking.cityId },
        select: { id: true, skills: true, status: true },
      });
      if (!tech) throw new BadRequestException('Technician not found in this city');
      if (!tech.skills.includes(booking.category as ServiceCategory)) {
        throw new BadRequestException('Technician lacks the required skill');
      }
      const conflict = await this.repo.hasTechnicianConflict({
        technicianId: tech.id,
        scheduledAt: booking.scheduledAt,
        excludeBookingId: id,
      });
      if (conflict) throw new ConflictException('Technician has a scheduling conflict');
    }

    const previousTech = booking.technicianId;
    const updated = await this.prisma.client.$transaction(async (tx) => {
      const row = await this.repo.update(
        id,
        {
          technician: { connect: { id: technicianId! } },
          status: BookingStatus.ASSIGNED,
          assignedAt: new Date(),
          updatedBy: actor.userId,
        },
        tx,
      );
      await this.activity.recordBookingActivity(
        id,
        {
          tenantId: actor.tenantId,
          type: previousTech ? ActivityType.REASSIGNED : ActivityType.ASSIGNED,
          actorUserId: actor.userId,
          fromStatus: booking.status,
          toStatus: BookingStatus.ASSIGNED,
          message:
            dto.reason ??
            (dto.autoPick
              ? 'Auto-assigned by scoring engine'
              : 'Manually assigned by dispatcher'),
          metadata: { technicianId, previousTechnicianId: previousTech },
        },
        tx,
      );
      return row;
    });

    this.events.publish(DomainEventName.BookingAssigned, {
      bookingId: id as BookingId,
      technicianId: technicianId as TechnicianId,
    });

    return updated;
  }

  async changeStatus(actor: AuthPrincipal, id: string, dto: ChangeBookingStatusDto) {
    const booking = await this.getById(actor, id);
    if (!canTransitionBooking(booking.status as BookingStatus, dto.status)) {
      throw new ForbiddenException(
        `Cannot transition booking from ${booking.status} to ${dto.status}`,
      );
    }

    const now = new Date();
    const stamps: Record<string, Date> = {};
    if (dto.status === BookingStatus.TECHNICIAN_EN_ROUTE) stamps['enRouteAt'] = now;
    if (dto.status === BookingStatus.IN_PROGRESS) stamps['startedAt'] = now;
    if (dto.status === BookingStatus.WAITING_PARTS) stamps['waitingPartsAt'] = now;
    if (dto.status === BookingStatus.COMPLETED) stamps['completedAt'] = now;
    if (dto.status === BookingStatus.CANCELLED) stamps['cancelledAt'] = now;

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const row = await this.repo.update(
        id,
        {
          status: dto.status,
          ...stamps,
          cancellationReason: dto.status === BookingStatus.CANCELLED ? dto.reason ?? null : undefined,
          finalAmountMinor:
            dto.status === BookingStatus.COMPLETED && dto.finalAmountMinor != null
              ? dto.finalAmountMinor
              : undefined,
          updatedBy: actor.userId,
        },
        tx,
      );
      const activityType =
        dto.status === BookingStatus.COMPLETED
          ? ActivityType.COMPLETED
          : dto.status === BookingStatus.CANCELLED
          ? ActivityType.CANCELLED
          : dto.status === BookingStatus.WAITING_PARTS
          ? ActivityType.WAITING_PARTS
          : dto.status === BookingStatus.IN_PROGRESS && booking.status === BookingStatus.WAITING_PARTS
          ? ActivityType.WORK_RESUMED
          : dto.status === BookingStatus.TECHNICIAN_EN_ROUTE
          ? ActivityType.TECHNICIAN_EN_ROUTE
          : ActivityType.STATUS_CHANGED;

      await this.activity.recordBookingActivity(
        id,
        {
          tenantId: actor.tenantId,
          type: activityType,
          actorUserId: actor.userId,
          fromStatus: booking.status,
          toStatus: dto.status,
          message: dto.reason ?? null,
          metadata: dto.finalAmountMinor != null ? { finalAmountMinor: dto.finalAmountMinor } : {},
        },
        tx,
      );
      return row;
    });

    this.events.publish(DomainEventName.BookingStatusChanged, {
      bookingId: id as BookingId,
      from: booking.status as BookingStatus,
      to: dto.status,
    });

    if (dto.status === BookingStatus.COMPLETED) {
      this.events.publish(DomainEventName.BookingCompleted, {
        bookingId: id as BookingId,
        technicianId: (booking.technicianId ?? null) as TechnicianId | null,
        finalAmountMinor: dto.finalAmountMinor ?? null,
      });
    }
    if (dto.status === BookingStatus.CANCELLED) {
      this.events.publish(DomainEventName.BookingCancelled, {
        bookingId: id as BookingId,
        reason: dto.reason ?? null,
      });
    }

    return updated;
  }

  async reschedule(actor: AuthPrincipal, id: string, dto: RescheduleBookingDto) {
    const booking = await this.getById(actor, id);
    if (TERMINAL_BOOKING_STATUSES.has(booking.status as BookingStatus)) {
      throw new ForbiddenException('Cannot reschedule a closed booking');
    }
    const newAt = new Date(dto.scheduledAt);
    if (newAt < new Date(Date.now() - 60 * 1000)) {
      throw new BadRequestException('scheduledAt must not be in the past');
    }

    // If a tech is already assigned, verify no conflict at the new time.
    if (booking.technicianId) {
      const conflict = await this.repo.hasTechnicianConflict({
        technicianId: booking.technicianId,
        scheduledAt: newAt,
        excludeBookingId: id,
      });
      if (conflict) {
        throw new ConflictException(
          'Technician has another job at the requested time. Reassign before rescheduling.',
        );
      }
    }

    const previousAt = booking.scheduledAt;
    const updated = await this.prisma.client.$transaction(async (tx) => {
      const row = await this.repo.update(
        id,
        {
          scheduledAt: newAt,
          scheduledTimeSlot: dto.scheduledTimeSlot ?? booking.scheduledTimeSlot,
          rescheduledFromAt: previousAt,
          rescheduleCount: { increment: 1 },
          status:
            booking.status === BookingStatus.PENDING ||
            booking.status === BookingStatus.CONFIRMED
              ? booking.status
              : BookingStatus.RESCHEDULED,
          updatedBy: actor.userId,
        },
        tx,
      );
      await this.activity.recordBookingActivity(
        id,
        {
          tenantId: actor.tenantId,
          type: ActivityType.RESCHEDULED,
          actorUserId: actor.userId,
          fromStatus: booking.status,
          toStatus: row.status,
          message: dto.reason ?? null,
          metadata: { from: previousAt.toISOString(), to: newAt.toISOString() },
        },
        tx,
      );
      return row;
    });

    this.events.publish(DomainEventName.BookingRescheduled, {
      bookingId: id as BookingId,
      fromAt: previousAt.toISOString(),
      toAt: newAt.toISOString(),
      reason: dto.reason ?? null,
    });

    return updated;
  }

  /**
   * Generate an OTP that the customer will receive (via WhatsApp/SMS) and the
   * technician must enter to start work. Only valid in TECHNICIAN_EN_ROUTE state.
   */
  async sendArrivalOtp(actor: AuthPrincipal, id: string) {
    const booking = await this.getById(actor, id);
    if (booking.status !== BookingStatus.TECHNICIAN_EN_ROUTE) {
      throw new ForbiddenException('OTP can only be issued while the technician is en-route');
    }

    const code = otp.generate({ length: 6 });
    const hash = otp.hash(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.prisma.client.$transaction(async (tx) => {
      await this.repo.update(
        id,
        {
          otpCodeHash: hash,
          otpExpiresAt: expiresAt,
          otpAttempts: 0,
          otpVerifiedAt: null,
          updatedBy: actor.userId,
        },
        tx,
      );
      await this.activity.recordBookingActivity(
        id,
        {
          tenantId: actor.tenantId,
          type: ActivityType.OTP_SENT,
          actorUserId: actor.userId,
          message: 'Arrival OTP issued to customer',
        },
        tx,
      );
    });

    this.events.publish(DomainEventName.BookingOtpSent, {
      bookingId: id as BookingId,
      expiresAt: expiresAt.toISOString(),
    });

    // Return the plaintext OTP only when running in development so the
    // notification dispatcher (console mode) can also surface it. In
    // production the code is delivered out-of-band.
    return process.env['NODE_ENV'] === 'development' ? { devCode: code } : { ok: true };
  }

  async verifyArrivalOtp(actor: AuthPrincipal, id: string, dto: VerifyBookingOtpDto) {
    const booking = await this.getById(actor, id);
    if (!booking.otpCodeHash || !booking.otpExpiresAt) {
      throw new BadRequestException('No OTP issued for this booking');
    }
    if (booking.otpVerifiedAt) {
      throw new ConflictException('OTP already verified');
    }
    if (booking.otpExpiresAt.getTime() < Date.now()) {
      throw new ForbiddenException('OTP expired — request a new one');
    }
    if (booking.otpAttempts >= OTP_MAX_ATTEMPTS) {
      throw new ForbiddenException('Too many failed attempts');
    }

    const ok = otp.verify(dto.code, booking.otpCodeHash);
    if (!ok) {
      await this.repo.update(id, { otpAttempts: { increment: 1 }, updatedBy: actor.userId });
      throw new ForbiddenException('Invalid OTP');
    }

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const row = await this.repo.update(
        id,
        {
          otpVerifiedAt: new Date(),
          status: BookingStatus.IN_PROGRESS,
          startedAt: new Date(),
          updatedBy: actor.userId,
        },
        tx,
      );
      await this.activity.recordBookingActivity(
        id,
        {
          tenantId: actor.tenantId,
          type: ActivityType.OTP_VERIFIED,
          actorUserId: actor.userId,
          fromStatus: booking.status,
          toStatus: BookingStatus.IN_PROGRESS,
          message: 'OTP verified — service started',
        },
        tx,
      );
      return row;
    });

    this.events.publish(DomainEventName.BookingOtpVerified, {
      bookingId: id as BookingId,
    });
    this.events.publish(DomainEventName.BookingStatusChanged, {
      bookingId: id as BookingId,
      from: booking.status as BookingStatus,
      to: BookingStatus.IN_PROGRESS,
    });

    return updated;
  }

  async addNote(actor: AuthPrincipal, id: string, dto: AddBookingNoteDto) {
    await this.getById(actor, id);
    const note = await this.prisma.client.$transaction(async (tx) => {
      const row = await this.repo.addNote({
        bookingId: id,
        tenantId: actor.tenantId,
        authorUserId: actor.userId,
        body: dto.body,
        isInternal: dto.isInternal ?? true,
      });
      await this.activity.recordBookingActivity(
        id,
        {
          tenantId: actor.tenantId,
          type: ActivityType.NOTE_ADDED,
          actorUserId: actor.userId,
          message: dto.body.slice(0, 140),
          metadata: { noteId: row.id, isInternal: row.isInternal },
        },
        tx,
      );
      return row;
    });

    this.events.publish(DomainEventName.BookingNoteAdded, {
      bookingId: id as BookingId,
      noteId: note.id,
    } as never);

    return note;
  }

  listNotes(_actor: AuthPrincipal, id: string) {
    return this.repo.listNotes(id);
  }

  async addAttachment(actor: AuthPrincipal, id: string, dto: AddBookingAttachmentDto) {
    await this.getById(actor, id);
    const att = await this.prisma.client.$transaction(async (tx) => {
      const row = await this.repo.addAttachment({
        bookingId: id,
        tenantId: actor.tenantId,
        ...dto,
        uploadedBy: actor.userId,
      });
      await this.activity.recordBookingActivity(
        id,
        {
          tenantId: actor.tenantId,
          type: ActivityType.ATTACHMENT_ADDED,
          actorUserId: actor.userId,
          message: dto.caption ?? `Uploaded ${dto.kind}`,
          metadata: { attachmentId: row.id, kind: dto.kind, url: dto.url },
        },
        tx,
      );
      return row;
    });

    this.events.publish(DomainEventName.BookingAttachmentAdded, {
      bookingId: id as BookingId,
      attachmentId: att.id,
    } as never);

    return att;
  }

  listAttachments(_actor: AuthPrincipal, id: string) {
    return this.repo.listAttachments(id);
  }

  async setSignature(actor: AuthPrincipal, id: string, dto: AddSignatureDto) {
    const booking = await this.getById(actor, id);
    if (booking.status !== BookingStatus.IN_PROGRESS && booking.status !== BookingStatus.COMPLETED) {
      throw new ForbiddenException('Signature can only be captured while in progress / on completion');
    }
    const updated = await this.prisma.client.$transaction(async (tx) => {
      const row = await this.repo.update(
        id,
        { customerSignatureUrl: dto.url, updatedBy: actor.userId },
        tx,
      );
      await this.activity.recordBookingActivity(
        id,
        {
          tenantId: actor.tenantId,
          type: ActivityType.SIGNATURE_CAPTURED,
          actorUserId: actor.userId,
          message: 'Customer signature captured',
          metadata: { url: dto.url },
        },
        tx,
      );
      return row;
    });
    return updated;
  }

  listActivities(_actor: AuthPrincipal, id: string) {
    return this.activity.listBookingActivities(id);
  }
}

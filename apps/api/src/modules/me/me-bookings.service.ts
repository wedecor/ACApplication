import type { AuthPrincipal } from '@ac/auth';
import type { Prisma } from '@ac/database';
import {
  BookingAttachmentKind,
  BookingStatus,
  type ServiceCategory,
  TicketPriority,
  TicketSource,
} from '@ac/types';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { BookingsService } from '../bookings/bookings.service';
import type { CreateBookingDto } from '../bookings/dto/create-booking.dto';
import { TicketsService } from '../support/tickets.service';
import type {
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
import {
  type AppBookingStatus,
  buildTimeline,
  categoryLabel,
  CUSTOMER_MUTABLE_BOOKING_STATUSES,
  humanizeSlug,
  LIVE_TRACKING_STATUSES,
  normalizeCategory,
  serverStatusesForFilter,
  toAppBookingStatus,
} from './me.mappers';
import { type CustomerContext,MeContextService } from './me-context.service';
import { computeEstimate, computeSlots, SLOT_WINDOWS, timeSlotLabel, zonedTimeToUtc } from './me-scheduling';

const DEFAULT_TZ = 'Asia/Kolkata';
/** Rough urban two-wheeler speed used for customer-facing ETAs. */
const ETA_SPEED_KMPH = 25;

const PHOTO_KINDS = [
  BookingAttachmentKind.PRE_SERVICE_PHOTO,
  BookingAttachmentKind.POST_SERVICE_PHOTO,
  BookingAttachmentKind.PARTS_PHOTO,
  BookingAttachmentKind.OTHER,
];

export const MY_BOOKING_SELECT = {
  id: true,
  code: true,
  status: true,
  category: true,
  serviceType: true,
  applianceBrand: true,
  applianceType: true,
  issueDescription: true,
  priority: true,
  scheduledAt: true,
  scheduledTimeSlot: true,
  estimatedAmountMinor: true,
  finalAmountMinor: true,
  discountMinor: true,
  couponCode: true,
  serviceMode: true,
  applianceId: true,
  arrivedAt: true,
  addressSnapshot: true,
  geoLatitude: true,
  geoLongitude: true,
  metadata: true,
  notes: true,
  createdAt: true,
  appliance: { select: { id: true, brand: true, category: true, modelNumber: true } },
  address: {
    select: { line1: true, line2: true, city: true, pincode: true, landmark: true, latitude: true, longitude: true },
  },
  technician: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      rating: true,
      totalJobs: true,
      user: { select: { avatarUrl: true } },
    },
  },
} satisfies Prisma.BookingSelect;

export type MyBookingRow = Prisma.BookingGetPayload<{ select: typeof MY_BOOKING_SELECT }>;

export interface BookingSummaryView {
  id: string;
  code: string;
  status: AppBookingStatus;
  applianceCategory: string;
  applianceLabel: string;
  issueLabel: string;
  scheduledAt: string;
  slotLabel: string | null;
  estimateMinor: number | null;
  amountMinor: number | null;
  address?: {
    line1: string;
    line2: string | null;
    city: string;
    pincode: string;
    landmark: string | null;
    lat: number | null;
    lng: number | null;
  };
  technician: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    rating: number | null;
    completedJobs: number | null;
    phone: string | null;
    whatsapp: string | null;
  } | null;
  isEmergency: boolean;
  applianceId: string | null;
  serviceMode: string;
  couponCode: string | null;
  discountMinor: number;
  createdAt: string;
}

function metaRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Pure row → app `BookingSummary` mapper. */
export function toBookingSummary(row: MyBookingRow): BookingSummaryView {
  const meta = metaRecord(row.metadata);
  const brand = row.appliance?.brand ?? row.applianceBrand;
  const label = categoryLabel(row.category);
  // Technician contact details are only shared while the job is live.
  const shareContact = LIVE_TRACKING_STATUSES.has(row.status);
  return {
    id: row.id,
    code: row.code,
    status: toAppBookingStatus(row.status, { arrived: !!row.arrivedAt }),
    applianceCategory: row.category,
    applianceLabel: brand ? `${brand} ${label}` : label,
    issueLabel: row.serviceType ?? row.issueDescription?.slice(0, 80) ?? label,
    scheduledAt: row.scheduledAt.toISOString(),
    slotLabel: (typeof meta.slotLabel === 'string' ? meta.slotLabel : null) ?? row.scheduledTimeSlot ?? null,
    estimateMinor: row.estimatedAmountMinor || null,
    amountMinor: row.finalAmountMinor ?? null,
    address: row.address
      ? {
          line1: row.address.line1,
          line2: row.address.line2,
          city: row.address.city,
          pincode: row.address.pincode,
          landmark: row.address.landmark,
          lat: row.geoLatitude ?? row.address.latitude,
          lng: row.geoLongitude ?? row.address.longitude,
        }
      : undefined,
    technician: row.technician
      ? {
          id: row.technician.id,
          fullName: row.technician.fullName,
          avatarUrl: row.technician.user?.avatarUrl ?? null,
          rating: row.technician.rating || null,
          completedJobs: row.technician.totalJobs,
          phone: shareContact ? row.technician.phone : null,
          whatsapp: shareContact ? row.technician.phone : null,
        }
      : null,
    isEmergency: row.priority === 'EMERGENCY',
    applianceId: row.applianceId,
    serviceMode: row.serviceMode,
    couponCode: row.couponCode,
    discountMinor: row.discountMinor,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Great-circle distance in km. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

@Injectable()
export class MeBookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: MeContextService,
    private readonly bookings: BookingsService,
    private readonly tickets: TicketsService,
    private readonly storage: StorageService,
  ) {}

  // ------------------------------------------------------------------ read

  async list(actor: AuthPrincipal, query: ListMyBookingsDto): Promise<BookingSummaryView[]> {
    const customer = await this.ctx.requireCustomer(actor);
    const rows = await this.prisma.client.booking.findMany({
      where: {
        tenantId: actor.tenantId,
        customerId: customer.id,
        deletedAt: null,
        status: { in: serverStatusesForFilter(query.status) },
      },
      orderBy: query.status === 'active' ? { scheduledAt: 'asc' } : { scheduledAt: 'desc' },
      take: 100,
      select: MY_BOOKING_SELECT,
    });
    return rows.map(toBookingSummary);
  }

  async detail(actor: AuthPrincipal, id: string) {
    const customer = await this.ctx.requireCustomer(actor);
    const row = await this.prisma.client.booking.findFirst({
      where: { id, tenantId: actor.tenantId, customerId: customer.id, deletedAt: null },
      select: {
        ...MY_BOOKING_SELECT,
        invoice: { select: { id: true, deletedAt: true } },
        rating: { select: { value: true, comment: true, npsScore: true, deletedAt: true } },
        attachments: {
          where: { deletedAt: null, kind: { in: PHOTO_KINDS } },
          orderBy: { createdAt: 'asc' },
          select: { url: true },
        },
        activities: {
          orderBy: { createdAt: 'asc' },
          take: 200,
          select: { toStatus: true, createdAt: true, message: true },
        },
      },
    });
    if (!row) throw new NotFoundException('Booking not found');
    return {
      ...toBookingSummary(row),
      notes: row.notes,
      photoUrls: row.attachments.map((a) => a.url),
      timeline: buildTimeline(row.activities, row.createdAt),
      invoiceId: row.invoice && !row.invoice.deletedAt ? row.invoice.id : null,
      rating:
        row.rating && !row.rating.deletedAt
          ? { value: row.rating.value, comment: row.rating.comment, npsScore: row.rating.npsScore }
          : null,
    };
  }

  // ---------------------------------------------------------------- create

  async create(actor: AuthPrincipal, dto: CreateMyBookingDto) {
    const customer = await this.ctx.requireCustomer(actor);
    const category = normalizeCategory(dto.applianceCategory);
    if (!category) throw new BadRequestException('Unknown applianceCategory');

    const address = await this.prisma.client.address.findFirst({
      where: { id: dto.addressId, customerId: customer.id, deletedAt: null },
    });
    if (!address) throw new BadRequestException('addressId does not belong to you');

    const appliance = dto.applianceId
      ? await this.prisma.client.customerAppliance.findFirst({
          where: { id: dto.applianceId, tenantId: actor.tenantId, customerId: customer.id, deletedAt: null },
          select: { id: true, brand: true, category: true, modelNumber: true },
        })
      : null;
    if (dto.applianceId && !appliance) throw new BadRequestException('applianceId does not belong to you');

    const photoUrls = dto.photoUrls ?? [];
    this.assertOwnMedia(actor.tenantId, photoUrls);

    const city = await this.resolveCity(actor.tenantId, address.city, customer);
    if (!city) throw new BadRequestException('Sorry, we do not serve this city yet');

    const catalog = await this.catalogFor(actor.tenantId, category);
    const estimate = computeEstimate({
      category,
      issueId: dto.issueId,
      isEmergency: dto.isEmergency,
      catalog,
    });

    const scheduledAt = new Date(dto.scheduledAt);
    const slotEnd = dto.slotEnd ? new Date(dto.slotEnd) : null;
    const issueLabel = dto.issueLabel ?? (dto.issueId ? humanizeSlug(dto.issueId) : undefined);

    const payload: CreateBookingDto = {
      customerId: customer.id,
      cityId: city.id,
      category,
      serviceType: issueLabel?.slice(0, 80),
      applianceBrand: (appliance?.brand ?? dto.brand)?.slice(0, 80),
      applianceType: appliance?.modelNumber?.slice(0, 80) ?? undefined,
      issueDescription: dto.notes,
      scheduledAt: scheduledAt.toISOString(),
      scheduledTimeSlot: timeSlotLabel(scheduledAt, slotEnd, city.timezone ?? DEFAULT_TZ),
      priority: dto.isEmergency ? 'EMERGENCY' : 'STANDARD',
      estimatedAmountMinor: estimate.estimateMinor,
      addressId: address.id,
      address: {
        line1: address.line1,
        line2: address.line2 ?? undefined,
        landmark: address.landmark ?? undefined,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country,
      },
      geoLatitude: address.latitude ?? undefined,
      geoLongitude: address.longitude ?? undefined,
      notes: dto.notes,
      // Validated + persisted by BookingsService (ownership, workshop job for non on-site modes).
      applianceId: appliance?.id,
      catalogItemId: estimate.catalogItemId ?? undefined,
      serviceMode: dto.serviceMode ?? 'ON_SITE',
    };

    // Reuse the canonical creation path (code allocation, activity, domain
    // events → notifications / dispatch) — then stamp the customer-app-only
    // fields that CreateBookingDto does not carry (coupon, slot label, source).
    const created = await this.bookings.create(actor, payload);
    if (!created) throw new BadRequestException('Failed to create booking');

    await this.prisma.client.booking.update({
      where: { id: created.id },
      data: {
        couponCode: dto.couponCode?.trim().toUpperCase() || null,
        metadata: {
          source: 'customer-app',
          issueId: dto.issueId ?? null,
          slotLabel: dto.slotLabel ?? null,
          contactPhone: dto.contactPhone ?? null,
          surgeMultiplier: estimate.surgeMultiplier,
        },
        updatedBy: actor.userId,
      },
    });

    for (const url of photoUrls) {
      await this.bookings.addAttachment(actor, created.id, {
        kind: BookingAttachmentKind.PRE_SERVICE_PHOTO,
        url,
        storageKey: this.storage.keyFromPublicUrl(url) ?? url,
        caption: 'Customer photo',
      });
    }

    return this.summaryById(actor.tenantId, customer.id, created.id);
  }

  // ------------------------------------------------------------- mutations

  async reschedule(actor: AuthPrincipal, id: string, dto: RescheduleMyBookingDto) {
    const { customer, booking } = await this.owned(actor, id);
    if (!CUSTOMER_MUTABLE_BOOKING_STATUSES.has(booking.status)) {
      throw new ForbiddenException('This booking can no longer be rescheduled from the app');
    }
    const city = await this.prisma.client.city.findFirst({
      where: { id: booking.cityId },
      select: { timezone: true },
    });
    const at = new Date(dto.scheduledAt);
    await this.bookings.reschedule(actor, id, {
      scheduledAt: at.toISOString(),
      scheduledTimeSlot: timeSlotLabel(at, dto.slotEnd ? new Date(dto.slotEnd) : null, city?.timezone ?? DEFAULT_TZ),
      reason: dto.reason ?? 'Rescheduled by customer',
    });
    // Old human slot label no longer applies.
    await this.prisma.client.booking.update({
      where: { id },
      data: { metadata: { ...metaRecord(booking.metadata), slotLabel: null } },
    });
    return this.summaryById(actor.tenantId, customer.id, id);
  }

  async cancel(actor: AuthPrincipal, id: string, dto: CancelMyBookingDto) {
    const { customer, booking } = await this.owned(actor, id);
    if (!CUSTOMER_MUTABLE_BOOKING_STATUSES.has(booking.status)) {
      throw new ForbiddenException('This booking can no longer be cancelled from the app — please contact support');
    }
    await this.bookings.changeStatus(actor, id, {
      status: BookingStatus.CANCELLED,
      reason: `Customer: ${dto.reason}`.slice(0, 500),
    });
    return this.summaryById(actor.tenantId, customer.id, id);
  }

  async addNote(actor: AuthPrincipal, id: string, dto: AddMyBookingNoteDto): Promise<{ ok: true }> {
    const { booking } = await this.owned(actor, id);
    if (booking.status === BookingStatus.CANCELLED) throw new ForbiddenException('Booking is cancelled');
    await this.bookings.addNote(actor, id, { body: dto.note, isInternal: false });
    return { ok: true };
  }

  async addPhotos(actor: AuthPrincipal, id: string, dto: AddMyBookingPhotosDto): Promise<{ ok: true }> {
    const { booking } = await this.owned(actor, id);
    if (booking.status === BookingStatus.CANCELLED) throw new ForbiddenException('Booking is cancelled');
    this.assertOwnMedia(actor.tenantId, dto.urls);
    for (const url of dto.urls) {
      await this.bookings.addAttachment(actor, id, {
        kind: BookingAttachmentKind.PRE_SERVICE_PHOTO,
        url,
        storageKey: this.storage.keyFromPublicUrl(url) ?? url,
        caption: 'Customer photo',
      });
    }
    return { ok: true };
  }

  /**
   * One rating per COMPLETED booking. After insert the technician's
   * `rating` is recomputed as the mean of all their (non-deleted) ratings.
   */
  async rate(actor: AuthPrincipal, id: string, dto: RateMyBookingDto): Promise<{ ok: true }> {
    const { customer, booking } = await this.owned(actor, id);
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('Only completed bookings can be rated');
    }
    const photos = dto.photos ?? [];
    this.assertOwnMedia(actor.tenantId, photos);

    const existing = await this.prisma.client.bookingRating.findUnique({
      where: { bookingId: id },
      select: { id: true },
    });
    if (existing) throw new ConflictException('You have already rated this booking');

    try {
      await this.prisma.client.bookingRating.create({
        data: {
          tenantId: actor.tenantId,
          bookingId: id,
          customerId: customer.id,
          technicianId: booking.technicianId,
          value: dto.value,
          npsScore: dto.npsScore ?? null,
          comment: dto.comment?.trim() || null,
          photos,
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw new ConflictException('You have already rated this booking');
      }
      throw err;
    }

    if (booking.technicianId) {
      await this.recomputeTechnicianRating(actor.tenantId, booking.technicianId);
    }
    return { ok: true };
  }

  async recomputeTechnicianRating(tenantId: string, technicianId: string): Promise<number> {
    const agg = await this.prisma.client.bookingRating.aggregate({
      where: { tenantId, technicianId, deletedAt: null },
      _avg: { value: true },
    });
    const avg = Math.round((agg._avg.value ?? 0) * 100) / 100;
    await this.prisma.client.technician.update({ where: { id: technicianId }, data: { rating: avg } });
    return avg;
  }

  async complaint(actor: AuthPrincipal, id: string, dto: MyBookingComplaintDto): Promise<{ ticketId: string }> {
    const { customer, booking } = await this.owned(actor, id);
    const ticket = await this.tickets.create(actor, {
      subject: `Complaint: ${dto.reason} (${booking.code})`.slice(0, 200),
      description: dto.description,
      customerId: customer.id,
      bookingId: booking.id,
      source: TicketSource.IN_APP_CHAT,
      priority: TicketPriority.HIGH,
      category: 'COMPLAINT',
      tags: ['complaint', 'customer-app'],
    });
    return { ticketId: ticket.id };
  }

  // -------------------------------------------------------------- tracking

  async technicianLocation(actor: AuthPrincipal, id: string) {
    const { booking } = await this.owned(actor, id);
    if (!booking.technicianId || !LIVE_TRACKING_STATUSES.has(booking.status)) return null;
    const tech = await this.prisma.client.technician.findFirst({
      where: { id: booking.technicianId, tenantId: actor.tenantId },
      select: {
        id: true,
        lastLatitude: true,
        lastLongitude: true,
        lastHeading: true,
        lastSpeedMps: true,
        lastLocationAt: true,
      },
    });
    if (tech?.lastLatitude == null || tech.lastLongitude == null || !tech.lastLocationAt) return null;

    const dest =
      booking.geoLatitude != null && booking.geoLongitude != null
        ? { lat: booking.geoLatitude, lng: booking.geoLongitude }
        : null;
    const distanceKm = dest
      ? Math.round(haversineKm({ lat: tech.lastLatitude, lng: tech.lastLongitude }, dest) * 10) / 10
      : null;
    return {
      bookingId: booking.id,
      technicianId: tech.id,
      lat: tech.lastLatitude,
      lng: tech.lastLongitude,
      bearing: tech.lastHeading,
      speedKph: tech.lastSpeedMps != null ? Math.round(tech.lastSpeedMps * 3.6) : null,
      distanceKm,
      etaMinutes: distanceKm != null ? Math.max(1, Math.round((distanceKm / ETA_SPEED_KMPH) * 60)) : null,
      recordedAt: tech.lastLocationAt.toISOString(),
    };
  }

  // ------------------------------------------------------- estimate / slots

  async estimate(actor: AuthPrincipal, dto: EstimateDto) {
    await this.ctx.requireCustomer(actor);
    const category = normalizeCategory(dto.applianceCategory);
    if (!category) throw new BadRequestException('Unknown applianceCategory');
    const catalog = await this.catalogFor(actor.tenantId, category);
    const est = computeEstimate({ category, issueId: dto.issueId, isEmergency: dto.isEmergency, catalog });
    return { estimateMinor: est.estimateMinor, visitMinutes: est.visitMinutes, surgeMultiplier: est.surgeMultiplier };
  }

  async slots(actor: AuthPrincipal, q: SlotsQueryDto) {
    const customer = await this.ctx.requireCustomer(actor);
    const category = normalizeCategory(q.applianceCategory);
    if (!category) throw new BadRequestException('Unknown applianceCategory');
    if (Number.isNaN(new Date(`${q.date}T00:00:00Z`).getTime())) throw new BadRequestException('Invalid date');

    const city = await this.resolveCity(actor.tenantId, q.city ?? null, customer);
    const tz = city?.timezone ?? DEFAULT_TZ;
    const dayStart = zonedTimeToUtc(q.date, SLOT_WINDOWS[0]!.startHour, tz);
    const dayEnd = zonedTimeToUtc(q.date, SLOT_WINDOWS[SLOT_WINDOWS.length - 1]!.endHour, tz);

    const [technicians, bookings] = await Promise.all([
      this.prisma.client.technician.findMany({
        where: {
          tenantId: actor.tenantId,
          deletedAt: null,
          skills: { has: category },
          ...(city ? { cityId: city.id } : {}),
        },
        select: { dailyCapacity: true },
      }),
      this.prisma.client.booking.findMany({
        where: {
          tenantId: actor.tenantId,
          deletedAt: null,
          category,
          ...(city ? { cityId: city.id } : {}),
          scheduledAt: { gte: dayStart, lt: dayEnd },
          status: { notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW, BookingStatus.DRAFT] },
        },
        select: { scheduledAt: true },
      }),
    ]);
    return { date: q.date, slots: computeSlots({ date: q.date, tz, technicians, bookings }) };
  }

  // --------------------------------------------------------------- helpers

  private async owned(actor: AuthPrincipal, id: string) {
    const customer = await this.ctx.requireCustomer(actor);
    const booking = await this.prisma.client.booking.findFirst({
      where: { id, tenantId: actor.tenantId, customerId: customer.id, deletedAt: null },
      select: {
        id: true,
        code: true,
        status: true,
        cityId: true,
        technicianId: true,
        geoLatitude: true,
        geoLongitude: true,
        metadata: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return { customer, booking };
  }

  private async summaryById(tenantId: string, customerId: string, id: string): Promise<BookingSummaryView> {
    const row = await this.prisma.client.booking.findFirst({
      where: { id, tenantId, customerId },
      select: MY_BOOKING_SELECT,
    });
    if (!row) throw new NotFoundException('Booking not found');
    return toBookingSummary(row);
  }

  private assertOwnMedia(tenantId: string, urls: string[]): void {
    if (!urls.length || !this.storage.isConfigured()) return;
    for (const url of urls) {
      if (!this.storage.isTenantObjectUrl(url, tenantId)) {
        throw new BadRequestException('Photos must be uploaded via /me/uploads/presign');
      }
    }
  }

  private catalogFor(tenantId: string, category: ServiceCategory) {
    return this.prisma.client.serviceCatalogItem.findMany({
      where: { tenantId, category, isActive: true, deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        basePriceMinor: true,
        visitChargeMinor: true,
        estimatedMinutes: true,
        sortOrder: true,
      },
      orderBy: { sortOrder: 'asc' },
      take: 50,
    });
  }

  /** City by name (case-insensitive) → customer's city → first active tenant city. */
  private async resolveCity(
    tenantId: string,
    name: string | null,
    customer: CustomerContext,
  ): Promise<{ id: string; timezone: string } | null> {
    const select = { id: true, timezone: true } as const;
    if (name?.trim()) {
      const byName = await this.prisma.client.city.findFirst({
        where: { tenantId, isActive: true, name: { equals: name.trim(), mode: 'insensitive' } },
        select,
      });
      if (byName) return byName;
    }
    if (customer.cityId) {
      const own = await this.prisma.client.city.findFirst({ where: { id: customer.cityId, tenantId }, select });
      if (own) return own;
    }
    return this.prisma.client.city.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select,
    });
  }
}

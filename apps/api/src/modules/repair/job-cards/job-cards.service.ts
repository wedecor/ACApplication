import type { AuthPrincipal } from '@ac/auth';
import type { Prisma } from '@ac/database';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { ChecklistsService } from '../checklists/checklists.service';
import {
  type ChecklistEntry,
  findMissingRequiredItems,
  mergeChecklistEntries,
} from '../domain/checklist';
import { RepairEventName } from '../domain/events';
import { compact, toNullableString } from '../domain/util';
import { RepairAccessService } from '../repair-access.service';
import { RepairEventsService } from '../repair-events.service';
import {
  CompleteJobCardDto,
  ListJobCardsDto,
  UpsertJobCardDto,
} from './dto/job-card.dto';

const BOOKING_SUMMARY = {
  id: true,
  code: true,
  status: true,
  category: true,
  scheduledAt: true,
  technicianId: true,
  applianceId: true,
  customer: { select: { id: true, fullName: true, phone: true } },
  appliance: { select: { id: true, brand: true, modelNumber: true, category: true } },
} satisfies Prisma.BookingSelect;

@Injectable()
export class JobCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checklists: ChecklistsService,
    private readonly access: RepairAccessService,
    private readonly events: RepairEventsService,
  ) {}

  async list(actor: AuthPrincipal, query: ListJobCardsDto) {
    const scopedTech = await this.access.scopedTechnicianId(actor);
    const technicianId = scopedTech ?? query.technicianId;
    const where: Prisma.JobCardWhereInput = {
      tenantId: actor.tenantId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(technicianId ? { technicianId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { booking: { code: { contains: query.search, mode: 'insensitive' } } },
              {
                booking: {
                  customer: { fullName: { contains: query.search, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.jobCard.findMany({
        where,
        include: { booking: { select: BOOKING_SUMMARY } },
        orderBy: { updatedAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.client.jobCard.count({ where }),
    ]);
    const items = await this.attachTechnicians(rows);
    return { items, total };
  }

  async getById(actor: AuthPrincipal, id: string) {
    const card = await this.prisma.client.jobCard.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
      include: { booking: { select: BOOKING_SUMMARY } },
    });
    if (!card) throw new NotFoundException('Job card not found');
    await this.access.assertBookingAccess(actor, card.booking);
    const [withTech] = await this.attachTechnicians([card]);
    const templates = await this.checklists.activeForCategory(actor.tenantId, card.booking.category);
    return { ...withTech!, templates };
  }

  /** `{ jobCard | null, templates, booking }` for the booking. */
  async getByBooking(actor: AuthPrincipal, bookingId: string) {
    const booking = await this.loadBooking(actor, bookingId);
    const [jobCard, templates] = await Promise.all([
      this.prisma.client.jobCard.findFirst({
        where: { bookingId, tenantId: actor.tenantId, deletedAt: null },
      }),
      this.checklists.activeForCategory(actor.tenantId, booking.category),
    ]);
    return { jobCard, templates, booking };
  }

  async upsert(actor: AuthPrincipal, bookingId: string, dto: UpsertJobCardDto) {
    const booking = await this.loadBooking(actor, bookingId);
    if (booking.status === 'CANCELLED') {
      throw new ForbiddenException('Booking is cancelled');
    }
    const existing = await this.prisma.client.jobCard.findFirst({
      where: { bookingId, tenantId: actor.tenantId, deletedAt: null },
    });
    const scopedTech = await this.access.scopedTechnicianId(actor);
    if (existing?.status === 'COMPLETED' && scopedTech) {
      throw new ConflictException('Job card is already completed');
    }

    const checklist = dto.checklist
      ? mergeChecklistEntries(existing?.checklist, await this.resolveEntries(actor, dto.checklist))
      : undefined;
    const readings = dto.readings
      ? { ...((existing?.readings as Record<string, unknown> | null) ?? {}), ...dto.readings }
      : undefined;

    const fields = compact({
      symptoms: dto.symptoms,
      faultCodes: dto.faultCodes?.map((c) => c.trim()).filter(Boolean),
      diagnosis: toNullableString(dto.diagnosis),
      rootCause: toNullableString(dto.rootCause),
      resolution: toNullableString(dto.resolution),
      readings: readings as Prisma.InputJsonValue | undefined,
      checklist: checklist as unknown as Prisma.InputJsonValue | undefined,
      partsRecommended: dto.partsRecommended as Prisma.InputJsonValue | undefined,
      photos: dto.photos,
      technicianRemarks: toNullableString(dto.technicianRemarks),
      customerRemarks: toNullableString(dto.customerRemarks),
    });

    if (!existing) {
      const now = new Date();
      return this.prisma.client.jobCard.create({
        data: {
          ...(fields as Omit<Prisma.JobCardUncheckedCreateInput, 'tenantId' | 'bookingId'>),
          tenantId: actor.tenantId,
          bookingId,
          technicianId: booking.technicianId,
          applianceId: booking.applianceId,
          status: 'IN_PROGRESS',
          startedAt: now,
          createdBy: actor.userId,
          updatedBy: actor.userId,
        },
      });
    }

    return this.prisma.client.jobCard.update({
      where: { id: existing.id },
      data: {
        ...(fields as Prisma.JobCardUncheckedUpdateInput),
        // Keep links in sync with the booking (reassignment, appliance picked later).
        technicianId: booking.technicianId ?? existing.technicianId,
        applianceId: booking.applianceId ?? existing.applianceId,
        ...(existing.status === 'DRAFT' ? { status: 'IN_PROGRESS' as const } : {}),
        ...(existing.startedAt ? {} : { startedAt: new Date() }),
        updatedBy: actor.userId,
      },
    });
  }

  async complete(actor: AuthPrincipal, bookingId: string, dto: CompleteJobCardDto) {
    const booking = await this.loadBooking(actor, bookingId);
    const card = await this.prisma.client.jobCard.findFirst({
      where: { bookingId, tenantId: actor.tenantId, deletedAt: null },
    });
    if (!card) throw new NotFoundException('Job card not started for this booking');
    if (card.status === 'COMPLETED') throw new ConflictException('Job card is already completed');

    const templates = await this.checklists.activeForCategory(actor.tenantId, booking.category);
    const missing = findMissingRequiredItems(templates, card.checklist);
    if (missing.length) {
      throw new BadRequestException({
        message: `${missing.length} required checklist item(s) not answered`,
        code: 'CHECKLIST_INCOMPLETE',
        missing,
      });
    }

    const firstTimeFix = dto.firstTimeFix ?? booking.waitingPartsAt == null;
    const updated = await this.prisma.client.jobCard.update({
      where: { id: card.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        firstTimeFix,
        startedAt: card.startedAt ?? new Date(),
        updatedBy: actor.userId,
      },
    });

    this.events.publish(RepairEventName.JobCardCompleted, {
      tenantId: actor.tenantId,
      jobCardId: card.id,
      bookingId,
      firstTimeFix,
    });
    return updated;
  }

  private async loadBooking(actor: AuthPrincipal, bookingId: string) {
    const booking = await this.prisma.client.booking.findFirst({
      where: { id: bookingId, tenantId: actor.tenantId },
      select: { ...BOOKING_SUMMARY, waitingPartsAt: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    await this.access.assertBookingAccess(actor, booking);
    return booking;
  }

  /** Validate template ids belong to the tenant and default each entry's kind. */
  private async resolveEntries(
    actor: AuthPrincipal,
    entries: UpsertJobCardDto['checklist'] & object,
  ): Promise<ChecklistEntry[]> {
    const ids = [...new Set(entries.map((e) => e.templateId))];
    const templates = await this.prisma.client.checklistTemplate.findMany({
      where: { id: { in: ids }, tenantId: actor.tenantId, deletedAt: null },
      select: { id: true, kind: true },
    });
    const kinds = new Map(templates.map((t) => [t.id, t.kind]));
    const unknown = ids.filter((id) => !kinds.has(id));
    if (unknown.length) {
      throw new BadRequestException({
        message: 'Unknown checklist template(s)',
        code: 'CHECKLIST_TEMPLATE_UNKNOWN',
        templateIds: unknown,
      });
    }
    return entries.map((e) => ({
      templateId: e.templateId,
      kind: e.kind ?? kinds.get(e.templateId)!,
      answers: e.answers ?? {},
    }));
  }

  private async attachTechnicians<T extends { technicianId: string | null }>(rows: T[]) {
    const ids = [...new Set(rows.map((r) => r.technicianId).filter((x): x is string => !!x))];
    const techs = ids.length
      ? await this.prisma.client.technician.findMany({
          where: { id: { in: ids } },
          select: { id: true, fullName: true, phone: true },
        })
      : [];
    const byId = new Map(techs.map((t) => [t.id, t]));
    return rows.map((r) => ({
      ...r,
      technician: r.technicianId ? (byId.get(r.technicianId) ?? null) : null,
    }));
  }
}

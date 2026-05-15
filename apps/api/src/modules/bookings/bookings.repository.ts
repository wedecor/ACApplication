import { Injectable } from '@nestjs/common';
import type { Booking, Prisma } from '@ac/database';

import { PrismaService } from '../../common/prisma/prisma.service';
import { type ListBookingsDto } from './dto/list-bookings.dto';

const BOOKING_INCLUDE = {
  customer: {
    select: { id: true, fullName: true, phone: true, email: true },
  },
  technician: {
    select: { id: true, fullName: true, phone: true, rating: true, status: true },
  },
  city: { select: { id: true, name: true, state: true } },
  address: true,
  lead: { select: { id: true, code: true } },
  _count: { select: { activities: true, bookingNotes: true, attachments: true } },
} satisfies Prisma.BookingInclude;

export type BookingWithRelations = Prisma.BookingGetPayload<{ include: typeof BOOKING_INCLUDE }>;

@Injectable()
export class BookingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.BookingCreateInput, tx?: Prisma.TransactionClient): Promise<Booking> {
    return (tx ?? this.prisma.client).booking.create({ data });
  }

  findById(tenantId: string, id: string): Promise<BookingWithRelations | null> {
    return this.prisma.client.booking.findFirst({
      where: { id, tenantId },
      include: BOOKING_INCLUDE,
    });
  }

  /**
   * Conflict check — would assigning `technicianId` to `scheduledAt` overlap
   * any of their existing in-flight bookings? 2h overlap window.
   */
  hasTechnicianConflict(input: {
    technicianId: string;
    scheduledAt: Date;
    excludeBookingId?: string;
  }): Promise<boolean> {
    const lo = new Date(input.scheduledAt.getTime() - 2 * 60 * 60 * 1000);
    const hi = new Date(input.scheduledAt.getTime() + 2 * 60 * 60 * 1000);
    return this.prisma.client.booking
      .findFirst({
        where: {
          technicianId: input.technicianId,
          status: { in: ['ASSIGNED', 'TECHNICIAN_EN_ROUTE', 'IN_PROGRESS', 'WAITING_PARTS'] },
          scheduledAt: { gte: lo, lt: hi },
          deletedAt: null,
          ...(input.excludeBookingId ? { NOT: { id: input.excludeBookingId } } : {}),
        },
        select: { id: true },
      })
      .then((b) => !!b);
  }

  async list(
    tenantId: string,
    query: ListBookingsDto,
  ): Promise<{ items: BookingWithRelations[]; total: number }> {
    const where: Prisma.BookingWhereInput = {
      tenantId,
      ...(query.status?.length ? { status: { in: query.status } } : {}),
      ...(query.paymentStatus?.length ? { paymentStatus: { in: query.paymentStatus } } : {}),
      ...(query.priority?.length ? { priority: { in: query.priority } } : {}),
      ...(query.category?.length ? { category: { in: query.category } } : {}),
      ...(query.cityId ? { cityId: query.cityId } : {}),
      ...(query.technicianId ? { technicianId: query.technicianId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.scheduledFrom || query.scheduledTo
        ? {
            scheduledAt: {
              ...(query.scheduledFrom ? { gte: new Date(query.scheduledFrom) } : {}),
              ...(query.scheduledTo ? { lte: new Date(query.scheduledTo) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { customer: { fullName: { contains: query.search, mode: 'insensitive' } } },
              { customer: { phone: { contains: query.search } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.booking.findMany({
        where,
        include: BOOKING_INCLUDE,
        orderBy: this.parseSort(query.sort ?? 'scheduledAt:asc'),
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.client.booking.count({ where }),
    ]);

    return { items, total };
  }

  update(id: string, data: Prisma.BookingUpdateInput, tx?: Prisma.TransactionClient): Promise<Booking> {
    return (tx ?? this.prisma.client).booking.update({ where: { id }, data });
  }

  addNote(input: {
    bookingId: string;
    tenantId: string;
    authorUserId: string;
    body: string;
    isInternal: boolean;
  }) {
    return this.prisma.client.bookingNote.create({ data: input });
  }

  listNotes(bookingId: string) {
    return this.prisma.client.bookingNote.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  addAttachment(input: {
    bookingId: string;
    tenantId: string;
    kind: Prisma.BookingAttachmentCreateInput['kind'];
    url: string;
    storageKey: string;
    mimeType?: string;
    sizeBytes?: number;
    caption?: string;
    uploadedBy?: string;
  }) {
    return this.prisma.client.bookingAttachment.create({
      data: {
        bookingId: input.bookingId,
        tenantId: input.tenantId,
        kind: input.kind,
        url: input.url,
        storageKey: input.storageKey,
        mimeType: input.mimeType ?? null,
        sizeBytes: input.sizeBytes ?? null,
        caption: input.caption ?? null,
        uploadedBy: input.uploadedBy ?? null,
      },
    });
  }

  listAttachments(bookingId: string) {
    return this.prisma.client.bookingAttachment.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async nextCode(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const lockKey = hashKey(`${tenantId}:booking:${year}`);
    return this.prisma.client.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${lockKey})`);
      const count = await tx.booking.count({
        where: { tenantId, code: { startsWith: `ACB-${year}-` } },
      });
      const seq = String(count + 1).padStart(6, '0');
      return `ACB-${year}-${seq}`;
    });
  }

  private parseSort(input: string): Prisma.BookingOrderByWithRelationInput[] {
    const allowed = new Set([
      'createdAt',
      'updatedAt',
      'scheduledAt',
      'status',
      'priority',
      'code',
    ]);
    return input
      .split(',')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => {
        const [field, dir] = segment.split(':');
        if (!field || !allowed.has(field)) return null;
        const direction: Prisma.SortOrder = dir === 'asc' ? 'asc' : 'desc';
        return { [field]: direction } as Prisma.BookingOrderByWithRelationInput;
      })
      .filter((v): v is Prisma.BookingOrderByWithRelationInput => v !== null);
  }
}

function hashKey(input: string): bigint {
  let h = 0n;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31n + BigInt(input.charCodeAt(i))) & 0x7fffffffffffffffn;
  }
  return h;
}

import { Readable } from 'node:stream';

import { BadRequestException, Injectable } from '@nestjs/common';
import {
  $Enums,
  type Prisma,
} from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { toCsvRow } from './csv';
import type { ExportQueryDto } from './dto/data-io.dto';

export const EXPORT_ENTITIES = [
  'customers',
  'leads',
  'bookings',
  'invoices',
  'appliances',
  'tasks',
] as const;
export type ExportEntity = (typeof EXPORT_ENTITIES)[number];

const BATCH = 500;

interface Column<T> {
  header: string;
  value: (row: T) => unknown;
}

/** Ordered column spec per entity. Secrets (OTP hashes, tokens, provider refs) are never listed. */
type Fetcher = (cursor: string | undefined) => Promise<({ id: string } & Record<string, unknown>)[]>;

@Injectable()
export class DataExportService {
  constructor(private readonly prisma: PrismaService) {}

  isEntity(entity: string): entity is ExportEntity {
    return (EXPORT_ENTITIES as readonly string[]).includes(entity);
  }

  /** Returns a stream of CSV text: header row + one row per record, paged by id cursor. */
  stream(tenantId: string, entity: string, query: ExportQueryDto): Readable {
    if (!this.isEntity(entity)) throw new BadRequestException(`Unsupported export entity: ${entity}`);
    const { fetch, columns } = this.spec(tenantId, entity, query);
    async function* generate(): AsyncGenerator<string> {
      yield toCsvRow(columns.map((c) => c.header));
      let cursor: string | undefined;
      for (;;) {
        const rows = await fetch(cursor);
        for (const row of rows) yield toCsvRow(columns.map((c) => c.value(row as never)));
        if (rows.length < BATCH) break;
        cursor = rows[rows.length - 1]!.id;
      }
    }
    return Readable.from(generate());
  }

  filename(entity: string): string {
    const stamp = new Date().toISOString().slice(0, 10);
    return `${entity}-${stamp}.csv`;
  }

  // ------------------------------------------------------------------ specs
  private page(cursor: string | undefined) {
    return {
      take: BATCH,
      orderBy: { id: 'asc' as const },
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    };
  }

  private createdRange(query: ExportQueryDto): Prisma.DateTimeFilter | undefined {
    if (!query.from && !query.to) return undefined;
    return {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {}),
    };
  }

  private enumFilter<T extends string>(values: Record<string, T>, status?: string): T | undefined {
    if (!status) return undefined;
    if (!(Object.values(values) as string[]).includes(status)) {
      throw new BadRequestException(`Invalid status filter: ${status}`);
    }
    return status as T;
  }

  private spec(
    tenantId: string,
    entity: ExportEntity,
    q: ExportQueryDto,
  ): { fetch: Fetcher; columns: Column<never>[] } {
    const createdAt = this.createdRange(q);
    const db = this.prisma.client;
    switch (entity) {
      case 'customers': {
        const where: Prisma.CustomerWhereInput = {
          tenantId,
          deletedAt: null,
          mergedIntoId: null,
          ...(createdAt ? { createdAt } : {}),
          ...(q.cityId ? { cityId: q.cityId } : {}),
          ...(q.search
            ? {
                OR: [
                  { fullName: { contains: q.search, mode: 'insensitive' } },
                  { phone: { contains: q.search } },
                  { email: { contains: q.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        };
        type Row = Prisma.CustomerGetPayload<{
          include: { city: { select: { name: true } }; account: { select: { name: true } } };
        }>;
        const columns: Column<Row>[] = [
          { header: 'id', value: (r) => r.id },
          { header: 'fullName', value: (r) => r.fullName },
          { header: 'phone', value: (r) => r.phone },
          { header: 'email', value: (r) => r.email },
          { header: 'city', value: (r) => r.city?.name },
          { header: 'cityId', value: (r) => r.cityId },
          { header: 'account', value: (r) => r.account?.name },
          { header: 'tags', value: (r) => r.tags.join(';') },
          { header: 'preferredLanguage', value: (r) => r.preferredLanguage },
          { header: 'loyaltyPoints', value: (r) => r.loyaltyPoints },
          { header: 'totalBookings', value: (r) => r.totalBookings },
          { header: 'lifetimeValueMinor', value: (r) => r.lifetimeValueMinor.toString() },
          { header: 'customFields', value: (r) => r.customFields },
          { header: 'createdAt', value: (r) => r.createdAt },
        ];
        return {
          columns: columns,
          fetch: (cursor) =>
            db.customer.findMany({
              where,
              include: { city: { select: { name: true } }, account: { select: { name: true } } },
              ...this.page(cursor),
            }),
        };
      }
      case 'leads': {
        const where: Prisma.LeadWhereInput = {
          tenantId,
          deletedAt: null,
          ...(createdAt ? { createdAt } : {}),
          ...(q.cityId ? { cityId: q.cityId } : {}),
          ...(q.status ? { status: this.enumFilter($Enums.LeadStatus, q.status) } : {}),
          ...(q.search
            ? {
                OR: [
                  { customerName: { contains: q.search, mode: 'insensitive' } },
                  { phone: { contains: q.search } },
                  { code: { contains: q.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        };
        type Row = Prisma.LeadGetPayload<object>;
        const columns: Column<Row>[] = [
          { header: 'id', value: (r) => r.id },
          { header: 'code', value: (r) => r.code },
          { header: 'customerName', value: (r) => r.customerName },
          { header: 'phone', value: (r) => r.phone },
          { header: 'whatsappNumber', value: (r) => r.whatsappNumber },
          { header: 'email', value: (r) => r.email },
          { header: 'source', value: (r) => r.source },
          { header: 'status', value: (r) => r.status },
          { header: 'priority', value: (r) => r.priority },
          { header: 'applianceType', value: (r) => r.applianceType },
          { header: 'applianceBrand', value: (r) => r.applianceBrand },
          { header: 'issueDescription', value: (r) => r.issueDescription },
          { header: 'addressLine1', value: (r) => r.addressLine1 },
          { header: 'cityId', value: (r) => r.cityId },
          { header: 'cityLabel', value: (r) => r.cityLabel },
          { header: 'pincode', value: (r) => r.pincode },
          { header: 'tags', value: (r) => r.tags.join(';') },
          { header: 'assignedUserId', value: (r) => r.assignedUserId },
          { header: 'bookingId', value: (r) => r.bookingId },
          { header: 'customFields', value: (r) => r.customFields },
          { header: 'createdAt', value: (r) => r.createdAt },
          { header: 'convertedAt', value: (r) => r.convertedAt },
        ];
        return {
          columns: columns,
          fetch: (cursor) => db.lead.findMany({ where, ...this.page(cursor) }),
        };
      }
      case 'bookings': {
        const where: Prisma.BookingWhereInput = {
          tenantId,
          deletedAt: null,
          ...(createdAt ? { createdAt } : {}),
          ...(q.cityId ? { cityId: q.cityId } : {}),
          ...(q.status ? { status: this.enumFilter($Enums.BookingStatus, q.status) } : {}),
          ...(q.search
            ? {
                OR: [
                  { code: { contains: q.search, mode: 'insensitive' } },
                  { customer: { fullName: { contains: q.search, mode: 'insensitive' } } },
                  { customer: { phone: { contains: q.search } } },
                ],
              }
            : {}),
        };
        // Explicit select keeps otpCodeHash and other secrets out of the export.
        const select = {
          id: true,
          code: true,
          status: true,
          category: true,
          serviceType: true,
          priority: true,
          paymentStatus: true,
          customerId: true,
          technicianId: true,
          cityId: true,
          scheduledAt: true,
          scheduledTimeSlot: true,
          completedAt: true,
          cancelledAt: true,
          estimatedAmountMinor: true,
          finalAmountMinor: true,
          discountMinor: true,
          couponCode: true,
          currency: true,
          applianceBrand: true,
          applianceType: true,
          customFields: true,
          createdAt: true,
          customer: { select: { fullName: true, phone: true } },
        } satisfies Prisma.BookingSelect;
        type Row = Prisma.BookingGetPayload<{ select: typeof select }>;
        const columns: Column<Row>[] = [
          { header: 'id', value: (r) => r.id },
          { header: 'code', value: (r) => r.code },
          { header: 'status', value: (r) => r.status },
          { header: 'category', value: (r) => r.category },
          { header: 'serviceType', value: (r) => r.serviceType },
          { header: 'priority', value: (r) => r.priority },
          { header: 'paymentStatus', value: (r) => r.paymentStatus },
          { header: 'customerId', value: (r) => r.customerId },
          { header: 'customerName', value: (r) => r.customer.fullName },
          { header: 'customerPhone', value: (r) => r.customer.phone },
          { header: 'technicianId', value: (r) => r.technicianId },
          { header: 'cityId', value: (r) => r.cityId },
          { header: 'scheduledAt', value: (r) => r.scheduledAt },
          { header: 'timeSlot', value: (r) => r.scheduledTimeSlot },
          { header: 'completedAt', value: (r) => r.completedAt },
          { header: 'cancelledAt', value: (r) => r.cancelledAt },
          { header: 'estimatedAmountMinor', value: (r) => r.estimatedAmountMinor },
          { header: 'finalAmountMinor', value: (r) => r.finalAmountMinor },
          { header: 'discountMinor', value: (r) => r.discountMinor },
          { header: 'couponCode', value: (r) => r.couponCode },
          { header: 'currency', value: (r) => r.currency },
          { header: 'applianceBrand', value: (r) => r.applianceBrand },
          { header: 'applianceType', value: (r) => r.applianceType },
          { header: 'customFields', value: (r) => r.customFields },
          { header: 'createdAt', value: (r) => r.createdAt },
        ];
        return {
          columns: columns,
          fetch: (cursor) => db.booking.findMany({ where, select, ...this.page(cursor) }),
        };
      }
      case 'invoices': {
        const where: Prisma.InvoiceWhereInput = {
          tenantId,
          deletedAt: null,
          ...(createdAt ? { createdAt } : {}),
          ...(q.status ? { status: this.enumFilter($Enums.InvoiceStatus, q.status) } : {}),
          ...(q.cityId ? { customer: { cityId: q.cityId } } : {}),
          ...(q.search ? { number: { contains: q.search, mode: 'insensitive' } } : {}),
        };
        const select = {
          id: true,
          number: true,
          status: true,
          customerId: true,
          bookingId: true,
          amcSubscriptionId: true,
          issueDate: true,
          dueDate: true,
          subtotalMinor: true,
          discountMinor: true,
          taxMinor: true,
          totalMinor: true,
          amountPaidMinor: true,
          amountRefundedMinor: true,
          dueAmountMinor: true,
          currency: true,
          gstEnabled: true,
          gstNumber: true,
          placeOfSupply: true,
          createdAt: true,
          customer: { select: { fullName: true, phone: true } },
        } satisfies Prisma.InvoiceSelect;
        type Row = Prisma.InvoiceGetPayload<{ select: typeof select }>;
        const columns: Column<Row>[] = [
          { header: 'id', value: (r) => r.id },
          { header: 'number', value: (r) => r.number },
          { header: 'status', value: (r) => r.status },
          { header: 'customerId', value: (r) => r.customerId },
          { header: 'customerName', value: (r) => r.customer.fullName },
          { header: 'customerPhone', value: (r) => r.customer.phone },
          { header: 'bookingId', value: (r) => r.bookingId },
          { header: 'amcSubscriptionId', value: (r) => r.amcSubscriptionId },
          { header: 'issueDate', value: (r) => r.issueDate },
          { header: 'dueDate', value: (r) => r.dueDate },
          { header: 'subtotalMinor', value: (r) => r.subtotalMinor },
          { header: 'discountMinor', value: (r) => r.discountMinor },
          { header: 'taxMinor', value: (r) => r.taxMinor },
          { header: 'totalMinor', value: (r) => r.totalMinor },
          { header: 'amountPaidMinor', value: (r) => r.amountPaidMinor },
          { header: 'amountRefundedMinor', value: (r) => r.amountRefundedMinor },
          { header: 'dueAmountMinor', value: (r) => r.dueAmountMinor },
          { header: 'currency', value: (r) => r.currency },
          { header: 'gstEnabled', value: (r) => r.gstEnabled },
          { header: 'gstNumber', value: (r) => r.gstNumber },
          { header: 'placeOfSupply', value: (r) => r.placeOfSupply },
          { header: 'createdAt', value: (r) => r.createdAt },
        ];
        return {
          columns: columns,
          fetch: (cursor) => db.invoice.findMany({ where, select, ...this.page(cursor) }),
        };
      }
      case 'appliances': {
        const where: Prisma.CustomerApplianceWhereInput = {
          tenantId,
          deletedAt: null,
          ...(createdAt ? { createdAt } : {}),
          ...(q.cityId ? { customer: { cityId: q.cityId } } : {}),
          ...(q.search
            ? {
                OR: [
                  { brand: { contains: q.search, mode: 'insensitive' } },
                  { modelNumber: { contains: q.search, mode: 'insensitive' } },
                  { serialNumber: { contains: q.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        };
        type Row = Prisma.CustomerApplianceGetPayload<{
          include: { customer: { select: { fullName: true; phone: true } } };
        }>;
        const columns: Column<Row>[] = [
          { header: 'id', value: (r) => r.id },
          { header: 'customerId', value: (r) => r.customerId },
          { header: 'customerName', value: (r) => r.customer.fullName },
          { header: 'customerPhone', value: (r) => r.customer.phone },
          { header: 'category', value: (r) => r.category },
          { header: 'brand', value: (r) => r.brand },
          { header: 'modelNumber', value: (r) => r.modelNumber },
          { header: 'serialNumber', value: (r) => r.serialNumber },
          { header: 'capacity', value: (r) => r.capacity },
          { header: 'installedLocation', value: (r) => r.installedLocation },
          { header: 'purchaseDate', value: (r) => r.purchaseDate },
          { header: 'installDate', value: (r) => r.installDate },
          { header: 'manufacturerWarrantyUntil', value: (r) => r.manufacturerWarrantyUntil },
          { header: 'extendedWarrantyUntil', value: (r) => r.extendedWarrantyUntil },
          { header: 'warrantyProvider', value: (r) => r.warrantyProvider },
          { header: 'lastServicedAt', value: (r) => r.lastServicedAt },
          { header: 'notes', value: (r) => r.notes },
          { header: 'customFields', value: (r) => r.customFields },
          { header: 'createdAt', value: (r) => r.createdAt },
        ];
        return {
          columns: columns,
          fetch: (cursor) =>
            db.customerAppliance.findMany({
              where,
              include: { customer: { select: { fullName: true, phone: true } } },
              ...this.page(cursor),
            }),
        };
      }
      case 'tasks': {
        const where: Prisma.TaskWhereInput = {
          tenantId,
          deletedAt: null,
          ...(createdAt ? { createdAt } : {}),
          ...(q.status ? { status: this.enumFilter($Enums.TaskStatus, q.status) } : {}),
          ...(q.search ? { title: { contains: q.search, mode: 'insensitive' } } : {}),
        };
        type Row = Prisma.TaskGetPayload<object>;
        const columns: Column<Row>[] = [
          { header: 'id', value: (r) => r.id },
          { header: 'title', value: (r) => r.title },
          { header: 'description', value: (r) => r.description },
          { header: 'status', value: (r) => r.status },
          { header: 'priority', value: (r) => r.priority },
          { header: 'dueAt', value: (r) => r.dueAt },
          { header: 'reminderAt', value: (r) => r.reminderAt },
          { header: 'assigneeUserId', value: (r) => r.assigneeUserId },
          { header: 'entityType', value: (r) => r.entityType },
          { header: 'entityId', value: (r) => r.entityId },
          { header: 'completedAt', value: (r) => r.completedAt },
          { header: 'createdAt', value: (r) => r.createdAt },
        ];
        return {
          columns: columns,
          fetch: (cursor) => db.task.findMany({ where, ...this.page(cursor) }),
        };
      }
    }
  }
}

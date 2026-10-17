import type { AuthPrincipal } from '@ac/auth';
import type { Prisma } from '@ac/database';
import { BookingStatus, InvoiceStatus } from '@ac/types';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import type {
  CreateCouponDto,
  ListCouponsDto,
  UpdateCouponDto,
} from './dto/coupon.dto';
import { type CouponEvaluation, evaluateCoupon, normaliseCouponCode } from './growth.rules';

type Tx = Prisma.TransactionClient;

export interface ValidateInput {
  category?: string | null;
  amountMinor?: number | null;
  /** Booking being priced — excluded from the "first booking" check. */
  bookingId?: string | null;
}

@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
  ) {}

  // ----------------------------------------------------------------- CRUD
  async list(actor: AuthPrincipal, q: ListCouponsDto) {
    const where: Prisma.CouponWhereInput = {
      tenantId: actor.tenantId,
      deletedAt: null,
      ...(q.isActive !== undefined ? { isActive: q.isActive } : {}),
      ...(q.search
        ? {
            OR: [
              { code: { contains: q.search, mode: 'insensitive' } },
              { description: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.pageSize,
        include: { _count: { select: { redemptions: true } } },
      }),
      this.prisma.client.coupon.count({ where }),
    ]);
    return { items, total };
  }

  async get(actor: AuthPrincipal, id: string) {
    const row = await this.prisma.client.coupon.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
      include: { _count: { select: { redemptions: true } } },
    });
    if (!row) throw new NotFoundException('Coupon not found');
    return row;
  }

  async create(actor: AuthPrincipal, dto: CreateCouponDto) {
    this.assertDiscountShape(dto.discountType, dto.discountValue);
    const code = normaliseCouponCode(dto.code);
    const existing = await this.prisma.client.coupon.findFirst({
      where: { tenantId: actor.tenantId, code },
      select: { id: true, deletedAt: true },
    });
    if (existing && !existing.deletedAt) throw new ConflictException(`Coupon ${code} already exists`);
    const data = {
      description: dto.description ?? null,
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      maxDiscountMinor: dto.maxDiscountMinor ?? null,
      minOrderMinor: dto.minOrderMinor ?? 0,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : new Date(),
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      usageLimit: dto.usageLimit ?? null,
      perCustomerLimit: dto.perCustomerLimit ?? 1,
      categories: dto.categories ?? [],
      firstBookingOnly: dto.firstBookingOnly ?? false,
      isActive: dto.isActive ?? true,
      updatedBy: actor.userId,
    };
    if (existing) {
      // Re-create a previously deleted code in place (unique on tenant+code).
      return this.prisma.client.coupon.update({
        where: { id: existing.id },
        data: { ...data, usedCount: 0, deletedAt: null, deletedBy: null, createdBy: actor.userId },
      });
    }
    return this.prisma.client.coupon.create({
      data: { ...data, tenantId: actor.tenantId, code, createdBy: actor.userId },
    });
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateCouponDto) {
    const current = await this.get(actor, id);
    if (dto.discountType !== undefined || dto.discountValue !== undefined) {
      this.assertDiscountShape(
        dto.discountType ?? (current.discountType),
        dto.discountValue ?? current.discountValue,
      );
    }
    const data: Prisma.CouponUpdateInput = { updatedBy: actor.userId };
    if (dto.code !== undefined) {
      const code = normaliseCouponCode(dto.code);
      if (code !== current.code) {
        const clash = await this.prisma.client.coupon.findFirst({
          where: { tenantId: actor.tenantId, code, NOT: { id } },
          select: { id: true },
        });
        if (clash) throw new ConflictException(`Coupon ${code} already exists`);
        data.code = code;
      }
    }
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.discountType !== undefined) data.discountType = dto.discountType;
    if (dto.discountValue !== undefined) data.discountValue = dto.discountValue;
    if (dto.maxDiscountMinor !== undefined) data.maxDiscountMinor = dto.maxDiscountMinor;
    if (dto.minOrderMinor !== undefined) data.minOrderMinor = dto.minOrderMinor;
    if (dto.validFrom !== undefined) data.validFrom = new Date(dto.validFrom);
    if (dto.validUntil !== undefined) data.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    if (dto.usageLimit !== undefined) data.usageLimit = dto.usageLimit;
    if (dto.perCustomerLimit !== undefined) data.perCustomerLimit = dto.perCustomerLimit;
    if (dto.categories !== undefined) data.categories = dto.categories;
    if (dto.firstBookingOnly !== undefined) data.firstBookingOnly = dto.firstBookingOnly;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return this.prisma.client.coupon.update({ where: { id }, data });
  }

  async remove(actor: AuthPrincipal, id: string) {
    await this.get(actor, id);
    await this.prisma.client.coupon.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.userId, isActive: false },
    });
    return { ok: true as const };
  }

  async redemptions(actor: AuthPrincipal, id: string, page: number, pageSize: number) {
    await this.get(actor, id);
    const where: Prisma.CouponRedemptionWhereInput = { couponId: id, tenantId: actor.tenantId, deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.client.couponRedemption.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { customer: { select: { id: true, fullName: true, phone: true } } },
      }),
      this.prisma.client.couponRedemption.count({ where }),
    ]);
    return { items, total };
  }

  // ------------------------------------------------------------ validation
  /**
   * Validate a code for a customer. Never throws for business-rule failures —
   * returns `{ valid: false, message }` so the customer app can show it inline.
   */
  async validate(
    tenantId: string,
    customerId: string,
    code: string,
    input: ValidateInput = {},
    tx?: Tx,
  ): Promise<CouponEvaluation & { couponId?: string }> {
    const db = tx ?? this.prisma.client;
    const normalised = normaliseCouponCode(code);
    if (!normalised) return { valid: false, discountMinor: 0, message: 'Enter a coupon code' };
    const coupon = await db.coupon.findFirst({ where: { tenantId, code: normalised, deletedAt: null } });
    if (!coupon) return { valid: false, discountMinor: 0, message: 'Coupon not found' };

    const [customerRedemptions, completedBookings] = await Promise.all([
      db.couponRedemption.count({
        where: {
          couponId: coupon.id,
          customerId,
          deletedAt: null,
          ...(input.bookingId ? { NOT: { bookingId: input.bookingId } } : {}),
        },
      }),
      coupon.firstBookingOnly
        ? db.booking.count({
            where: {
              tenantId,
              customerId,
              deletedAt: null,
              status: BookingStatus.COMPLETED,
              ...(input.bookingId ? { NOT: { id: input.bookingId } } : {}),
            },
          })
        : Promise.resolve(0),
    ]);

    const result = evaluateCoupon(
      { ...coupon, discountType: coupon.discountType, categories: coupon.categories },
      {
        now: new Date(),
        category: input.category ?? null,
        amountMinor: input.amountMinor ?? null,
        customerRedemptions,
        completedBookings,
      },
    );
    return { ...result, couponId: coupon.id };
  }

  /**
   * Atomically redeem a coupon: re-validates inside a transaction, claims a
   * usage slot with a conditional increment (so concurrent redemptions can
   * never exceed `usageLimit`), and writes the redemption row. Idempotent per
   * booking — a second call for the same booking returns the existing row.
   */
  async redeem(
    tenantId: string,
    customerId: string,
    code: string,
    input: ValidateInput & { invoiceId?: string | null },
  ) {
    return this.prisma.client.$transaction(async (tx) => {
      if (input.bookingId) {
        const prior = await tx.couponRedemption.findFirst({
          where: { tenantId, bookingId: input.bookingId, deletedAt: null },
        });
        if (prior) return prior;
      }
      const check = await this.validate(tenantId, customerId, code, input, tx);
      if (!check.valid || !check.couponId) {
        throw new UnprocessableEntityException(check.message ?? 'Coupon is not valid');
      }
      const claimed = await tx.$executeRaw`
        UPDATE "coupons" SET "usedCount" = "usedCount" + 1, "updatedAt" = NOW()
        WHERE "id" = ${check.couponId}
          AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
      if (claimed === 0) throw new ConflictException('Coupon usage limit reached');
      return tx.couponRedemption.create({
        data: {
          tenantId,
          couponId: check.couponId,
          customerId,
          bookingId: input.bookingId ?? null,
          invoiceId: input.invoiceId ?? null,
          discountMinor: check.discountMinor,
        },
      });
    });
  }

  /** Reverse a redemption (used when the downstream invoice update fails). */
  async releaseRedemption(redemptionId: string): Promise<void> {
    await this.prisma.client.$transaction(async (tx) => {
      const row = await tx.couponRedemption.findUnique({ where: { id: redemptionId } });
      if (!row || row.deletedAt) return;
      await tx.couponRedemption.update({ where: { id: row.id }, data: { deletedAt: new Date() } });
      await tx.$executeRaw`
        UPDATE "coupons" SET "usedCount" = GREATEST("usedCount" - 1, 0), "updatedAt" = NOW()
        WHERE "id" = ${row.couponId}`;
    });
  }

  /**
   * Apply a booking's `couponCode` to its freshly created (DRAFT) invoice.
   * Discount is computed on the invoice's pre-discount grand total and written
   * through `InvoicesService.update` so totals/GST are recomputed canonically.
   */
  async applyBookingCouponToInvoice(invoiceId: string): Promise<'applied' | 'skipped'> {
    const invoice = await this.prisma.client.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        tenantId: true,
        customerId: true,
        bookingId: true,
        status: true,
        discountMinor: true,
        totalMinor: true,
      },
    });
    if (!invoice?.bookingId || invoice.status !== InvoiceStatus.DRAFT || invoice.discountMinor > 0) {
      return 'skipped';
    }
    const booking = await this.prisma.client.booking.findUnique({
      where: { id: invoice.bookingId },
      select: { id: true, couponCode: true, category: true },
    });
    if (!booking?.couponCode) return 'skipped';

    const amountMinor = invoice.totalMinor;
    let redemption;
    try {
      redemption = await this.redeem(invoice.tenantId, invoice.customerId, booking.couponCode, {
        bookingId: booking.id,
        invoiceId: invoice.id,
        category: booking.category,
        amountMinor,
      });
    } catch (err) {
      this.logger.warn(
        { invoiceId, bookingId: booking.id, reason: (err as Error).message },
        'Booking coupon not applied',
      );
      return 'skipped';
    }
    if (redemption.discountMinor <= 0) return 'skipped';

    try {
      await this.invoices.update(this.systemActor(invoice.tenantId), invoice.id, {
        discountMinor: redemption.discountMinor,
      });
      await this.prisma.client.$transaction([
        this.prisma.client.couponRedemption.update({
          where: { id: redemption.id },
          data: { invoiceId: invoice.id },
        }),
        this.prisma.client.booking.update({
          where: { id: booking.id },
          data: { discountMinor: redemption.discountMinor },
        }),
      ]);
      return 'applied';
    } catch (err) {
      this.logger.warn({ err, invoiceId }, 'Failed to apply coupon discount to invoice; releasing');
      await this.releaseRedemption(redemption.id).catch(() => undefined);
      return 'skipped';
    }
  }

  private systemActor(tenantId: string): AuthPrincipal {
    return {
      userId: 'system:growth',
      tenantId,
      email: null,
      phone: null,
      roles: [],
      permissions: [],
      sessionId: 'system',
      permissionVersion: 0,
      iat: 0,
      exp: 0,
    };
  }

  private assertDiscountShape(type: 'PERCENT' | 'FLAT', value: number): void {
    if (type === 'PERCENT' && (value <= 0 || value > 10_000)) {
      throw new UnprocessableEntityException('PERCENT discountValue must be 1..10000 basis points');
    }
    if (value <= 0) throw new UnprocessableEntityException('discountValue must be positive');
  }
}

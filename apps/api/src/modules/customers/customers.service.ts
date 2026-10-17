import type { AuthPrincipal } from '@ac/auth';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { CustomFieldsService } from '../productivity/custom-fields.service';
import { CustomersRepository, type CustomerWithRelations } from './customers.repository';
import type {
  CreateCustomerDto,
  FindDuplicatesDto,
  UpdateCustomerDto,
} from './dto/customer-write.dto';
import type { ListCustomersDto } from './dto/list-customers.dto';
import { type DuplicateCandidate, type DuplicateProbe, rankDuplicates } from './duplicates';
import { normalizePhoneE164, phoneVariants } from './phone';

export type CustomerListItem = ReturnType<CustomersService['serialize']>;

export interface CreateCustomerInput {
  fullName: string;
  phone: string;
  email?: string | null;
  cityId?: string | null;
  accountId?: string | null;
  tags?: string[];
  customFields?: Record<string, unknown>;
  preferredLanguage?: string;
}

/** Normalise tags: trimmed, lower-cased, de-duplicated, empties dropped. */
export function normalizeTags(tags: readonly string[] | undefined | null): string[] {
  if (!tags) return [];
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

export function splitFullName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts.shift() ?? fullName.trim();
  return { firstName, lastName: parts.length ? parts.join(' ') : null };
}

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly repo: CustomersRepository,
    private readonly prisma: PrismaService,
    private readonly customFields: CustomFieldsService,
  ) {}

  // -------------------------------------------------------------------- read
  async list(actor: AuthPrincipal, query: ListCustomersDto) {
    const { items, total } = await this.repo.list(actor.tenantId, query);
    return {
      items: items.map((row) => this.serialize(row)),
      total,
    };
  }

  /** Merged customers (mergedIntoId set) are soft-deleted and resolve to 404. */
  async get(actor: AuthPrincipal, id: string) {
    const row = await this.repo.findById(actor.tenantId, id);
    if (!row) throw new NotFoundException('Customer not found');
    return this.serialize(row);
  }

  // ------------------------------------------------------------------ create
  create(actor: AuthPrincipal, dto: CreateCustomerDto) {
    return this.createForTenant(actor.tenantId, actor.userId, dto);
  }

  /**
   * Creates the backing User (customer login identity) + Customer + CUSTOMER
   * role assignment atomically. Reused by the CSV importer.
   */
  async createForTenant(tenantId: string, actorUserId: string | null, input: CreateCustomerInput) {
    const phone = normalizePhoneE164(input.phone);
    if (!phone) throw new BadRequestException('Invalid phone number');
    const email = input.email ? input.email.trim().toLowerCase() : null;

    await this.assertPhoneFree(tenantId, phone);
    if (input.accountId) await this.assertAccount(tenantId, input.accountId);
    if (input.cityId) await this.assertCity(tenantId, input.cityId);
    const customFields = await this.customFields.validateCustomFields(
      tenantId,
      'customer',
      input.customFields ?? {},
    );

    const { firstName, lastName } = splitFullName(input.fullName);
    try {
      const id = await this.prisma.client.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            tenantId,
            phone,
            email,
            firstName,
            lastName,
            status: 'ACTIVE',
            authProvider: 'OTP',
            createdBy: actorUserId,
          },
          select: { id: true },
        });
        const role = await tx.role.findFirst({
          where: { tenantId, key: 'CUSTOMER' },
          select: { id: true },
        });
        if (role) {
          await tx.userRoleAssignment.create({
            data: { userId: user.id, roleId: role.id, assignedBy: actorUserId },
          });
        }
        const customer = await tx.customer.create({
          data: {
            tenantId,
            userId: user.id,
            fullName: input.fullName.trim(),
            phone,
            email,
            cityId: input.cityId ?? null,
            accountId: input.accountId ?? null,
            tags: normalizeTags(input.tags),
            customFields: customFields as Prisma.InputJsonValue,
            preferredLanguage: input.preferredLanguage ?? 'en',
          },
          select: { id: true },
        });
        return customer.id;
      });
      const row = await this.repo.findById(tenantId, id);
      return this.serialize(row!);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          message: 'A user with this phone or email already exists',
          code: 'CUSTOMER_EXISTS',
        });
      }
      throw err;
    }
  }

  // ------------------------------------------------------------------ update
  async update(actor: AuthPrincipal, id: string, dto: UpdateCustomerDto) {
    const tenantId = actor.tenantId;
    const existing = await this.prisma.client.customer.findFirst({
      where: { id, tenantId, deletedAt: null, mergedIntoId: null },
      select: { id: true, userId: true, phone: true, customFields: true },
    });
    if (!existing) throw new NotFoundException('Customer not found');

    const data: Prisma.CustomerUncheckedUpdateInput = {};
    const userData: Prisma.UserUpdateInput = {};

    if (dto.fullName !== undefined) {
      data.fullName = dto.fullName.trim();
      const { firstName, lastName } = splitFullName(dto.fullName);
      userData.firstName = firstName;
      userData.lastName = lastName;
    }
    if (dto.phone !== undefined) {
      const phone = normalizePhoneE164(dto.phone);
      if (!phone) throw new BadRequestException('Invalid phone number');
      if (phone !== existing.phone) {
        await this.assertPhoneFree(tenantId, phone, id);
        data.phone = phone;
        userData.phone = phone;
      }
    }
    if (dto.email !== undefined) {
      const email = dto.email ? dto.email.trim().toLowerCase() : null;
      data.email = email;
      userData.email = email;
    }
    if (dto.cityId !== undefined) {
      if (dto.cityId) await this.assertCity(tenantId, dto.cityId);
      data.cityId = dto.cityId || null;
    }
    if (dto.accountId !== undefined) {
      if (dto.accountId) await this.assertAccount(tenantId, dto.accountId);
      data.accountId = dto.accountId || null;
    }
    if (dto.tags !== undefined) data.tags = normalizeTags(dto.tags);
    if (dto.preferredLanguage !== undefined) data.preferredLanguage = dto.preferredLanguage;
    if (dto.customFields !== undefined) {
      const patch = await this.customFields.validateCustomFields(
        tenantId,
        'customer',
        dto.customFields,
        { partial: true },
      );
      const merged: Record<string, unknown> = { ...asRecord(existing.customFields) };
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) delete merged[k];
        else merged[k] = v;
      }
      data.customFields = merged as Prisma.InputJsonValue;
    }

    try {
      await this.prisma.client.$transaction(async (tx) => {
        if (Object.keys(userData).length) {
          await tx.user.update({ where: { id: existing.userId }, data: userData });
        }
        await tx.customer.update({ where: { id }, data });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Phone or email already in use by another user');
      }
      throw err;
    }
    return this.get(actor, id);
  }

  // -------------------------------------------------------------- duplicates
  async findDuplicates(actor: AuthPrincipal, dto: FindDuplicatesDto) {
    const probe: DuplicateProbe = {
      phone: dto.phone ? (normalizePhoneE164(dto.phone) ?? dto.phone) : null,
      email: dto.email ?? null,
      fullName: dto.fullName ?? null,
      pincodes: dto.pincode ? [dto.pincode.trim()] : [],
    };
    return this.duplicatesFor(actor.tenantId, probe, dto.excludeId);
  }

  async duplicatesOf(actor: AuthPrincipal, id: string) {
    const row = await this.prisma.client.customer.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null, mergedIntoId: null },
      select: {
        id: true,
        phone: true,
        email: true,
        fullName: true,
        addresses: { where: { deletedAt: null }, select: { pincode: true } },
      },
    });
    if (!row) throw new NotFoundException('Customer not found');
    return this.duplicatesFor(
      actor.tenantId,
      {
        phone: row.phone,
        email: row.email,
        fullName: row.fullName,
        pincodes: [...new Set(row.addresses.map((a) => a.pincode))],
      },
      row.id,
    );
  }

  private async duplicatesFor(tenantId: string, probe: DuplicateProbe, excludeId?: string) {
    const or: Prisma.CustomerWhereInput[] = [];
    if (probe.phone) {
      const e164 = normalizePhoneE164(probe.phone);
      or.push({ phone: { in: e164 ? phoneVariants(e164) : [probe.phone] } });
      const tail = probe.phone.replace(/\D/g, '').slice(-10);
      if (tail.length === 10) or.push({ phone: { endsWith: tail } });
    }
    if (probe.email) or.push({ email: { equals: probe.email.trim(), mode: 'insensitive' } });
    if (probe.pincodes?.length) {
      or.push({ addresses: { some: { pincode: { in: probe.pincodes }, deletedAt: null } } });
    }
    const firstToken = (probe.fullName ?? '').trim().split(/\s+/)[0];
    if (firstToken && firstToken.length >= 3) {
      or.push({ fullName: { contains: firstToken, mode: 'insensitive' } });
    }
    if (!or.length) return { items: [] };

    const rows = await this.prisma.client.customer.findMany({
      where: {
        tenantId,
        deletedAt: null,
        mergedIntoId: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: or,
      },
      select: {
        id: true,
        phone: true,
        email: true,
        fullName: true,
        addresses: { where: { deletedAt: null }, select: { pincode: true } },
      },
      take: 200,
    });
    const candidates: DuplicateCandidate[] = rows.map((r) => ({
      id: r.id,
      phone: r.phone,
      email: r.email,
      fullName: r.fullName,
      pincodes: r.addresses.map((a) => a.pincode),
    }));
    const matches = rankDuplicates(probe, candidates, excludeId).slice(0, 20);
    if (!matches.length) return { items: [] };

    const full = await this.prisma.client.customer.findMany({
      where: { id: { in: matches.map((m) => m.id) }, tenantId },
      include: {
        city: { select: { id: true, name: true, state: true } },
        account: { select: { id: true, name: true } },
        _count: { select: { bookings: true, invoices: true } },
      },
    });
    const byId = new Map(full.map((c) => [c.id, c]));
    return {
      items: matches
        .filter((m) => byId.has(m.id))
        .map((m) => ({
          customer: this.serialize(byId.get(m.id)!),
          reasons: m.reasons,
          score: m.score,
        })),
    };
  }

  // ------------------------------------------------------------------- merge
  /**
   * Merge `sourceId` (the duplicate) into `intoId` (the survivor). Every
   * customer-owned row is re-pointed in one transaction; the duplicate is
   * stamped with `mergedIntoId` and soft-deleted. The duplicate's login User
   * is left untouched.
   */
  async merge(actor: AuthPrincipal, sourceId: string, intoId: string) {
    if (sourceId === intoId) throw new BadRequestException('Cannot merge a customer into itself');
    const tenantId = actor.tenantId;

    await this.prisma.client.$transaction(
      async (tx) => {
        const [source, target] = await Promise.all([
          tx.customer.findFirst({ where: { id: sourceId, tenantId, deletedAt: null } }),
          tx.customer.findFirst({ where: { id: intoId, tenantId, deletedAt: null } }),
        ]);
        if (!source) throw new NotFoundException('Customer to merge not found');
        if (!target) throw new NotFoundException('Survivor customer not found');
        if (source.mergedIntoId) throw new ConflictException('Customer was already merged');
        if (target.mergedIntoId) {
          throw new BadRequestException('Cannot merge into a customer that was itself merged');
        }

        const move = { where: { customerId: sourceId }, data: { customerId: intoId } };
        await tx.address.updateMany(move);
        await tx.booking.updateMany(move);
        await tx.invoice.updateMany(move);
        await tx.paymentTransaction.updateMany(move);
        await tx.refund.updateMany(move);
        await tx.creditNote.updateMany(move);
        await tx.customerLedgerEntry.updateMany(move);
        await tx.quotation.updateMany(move);
        await tx.aMCSubscription.updateMany(move);
        await tx.supportTicket.updateMany(move);
        await tx.conversation.updateMany(move);
        await tx.callLog.updateMany(move);
        await tx.customerAppliance.updateMany(move);
        await tx.warrantyClaim.updateMany(move);
        await tx.bookingRating.updateMany(move);
        await tx.savedPaymentMethod.updateMany(move);
        await tx.couponRedemption.updateMany(move);
        await tx.loyaltyLedgerEntry.updateMany(move);
        await tx.opportunity.updateMany(move);
        await tx.task.updateMany({
          where: { tenantId, entityType: 'customer', entityId: sourceId },
          data: { entityId: intoId },
        });

        // Referrals between the two records would become self-referrals.
        const now = new Date();
        await tx.referral.updateMany({
          where: {
            OR: [
              { referrerCustomerId: sourceId, referredCustomerId: intoId },
              { referrerCustomerId: intoId, referredCustomerId: sourceId },
            ],
            deletedAt: null,
          },
          data: { deletedAt: now, status: 'REJECTED' },
        });
        await tx.referral.updateMany({
          where: { referrerCustomerId: sourceId },
          data: { referrerCustomerId: intoId },
        });
        const [sourceReferred, targetReferred] = await Promise.all([
          tx.referral.findUnique({ where: { referredCustomerId: sourceId } }),
          tx.referral.findUnique({ where: { referredCustomerId: intoId } }),
        ]);
        if (sourceReferred && !sourceReferred.deletedAt) {
          if (!targetReferred) {
            await tx.referral.update({
              where: { id: sourceReferred.id },
              data: { referredCustomerId: intoId },
            });
          } else {
            await tx.referral.update({
              where: { id: sourceReferred.id },
              data: { deletedAt: now },
            });
          }
        }
        const [sourceCode, targetCode] = await Promise.all([
          tx.referralCode.findUnique({ where: { customerId: sourceId } }),
          tx.referralCode.findUnique({ where: { customerId: intoId } }),
        ]);
        if (sourceCode) {
          if (!targetCode) {
            await tx.referralCode.update({
              where: { id: sourceCode.id },
              data: { customerId: intoId },
            });
          } else {
            await tx.referralCode.update({ where: { id: sourceCode.id }, data: { deletedAt: now } });
          }
        }

        // Release the duplicate's unique default address before reassigning.
        const defaultAddressId = target.defaultAddressId ?? source.defaultAddressId;
        await tx.customer.update({
          where: { id: sourceId },
          data: {
            mergedIntoId: intoId,
            deletedAt: now,
            defaultAddressId: null,
            loyaltyPoints: 0,
          },
        });

        const [bookingCount, paid] = await Promise.all([
          tx.booking.count({ where: { customerId: intoId, deletedAt: null } }),
          tx.invoice.aggregate({
            where: { customerId: intoId, deletedAt: null },
            _sum: { amountPaidMinor: true, amountRefundedMinor: true },
          }),
        ]);
        const invoiceLtv = BigInt(
          (paid._sum.amountPaidMinor ?? 0) - (paid._sum.amountRefundedMinor ?? 0),
        );
        const summedLtv = target.lifetimeValueMinor + source.lifetimeValueMinor;

        await tx.customer.update({
          where: { id: intoId },
          data: {
            email: target.email ?? source.email,
            cityId: target.cityId ?? source.cityId,
            accountId: target.accountId ?? source.accountId,
            defaultAddressId,
            tags: normalizeTags([...target.tags, ...source.tags]),
            customFields: {
              ...asRecord(source.customFields),
              ...asRecord(target.customFields),
            } as Prisma.InputJsonValue,
            loyaltyPoints: target.loyaltyPoints + source.loyaltyPoints,
            totalBookings: bookingCount,
            lifetimeValueMinor: invoiceLtv > summedLtv ? invoiceLtv : summedLtv,
          },
        });
      },
      { timeout: 30_000 },
    );

    this.logger.log({ sourceId, intoId, tenantId }, 'customer.merged');
    return this.get(actor, intoId);
  }

  // ----------------------------------------------------------------- helpers
  private async assertPhoneFree(tenantId: string, phone: string, excludeCustomerId?: string) {
    const clash = await this.prisma.client.customer.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        mergedIntoId: null,
        phone: { in: phoneVariants(phone) },
        ...(excludeCustomerId ? { id: { not: excludeCustomerId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException({
        message: 'A customer with this phone already exists',
        code: 'CUSTOMER_EXISTS',
        customerId: clash.id,
      });
    }
  }

  private async assertAccount(tenantId: string, accountId: string) {
    const acc = await this.prisma.client.account.findFirst({
      where: { id: accountId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!acc) throw new BadRequestException('Account not found');
  }

  private async assertCity(tenantId: string, cityId: string) {
    const city = await this.prisma.client.city.findFirst({
      where: { id: cityId, tenantId },
      select: { id: true },
    });
    if (!city) throw new BadRequestException('City not found');
  }

  private serialize(row: CustomerWithRelations) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      cityId: row.cityId,
      accountId: row.accountId,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      tags: row.tags,
      customFields: asRecord(row.customFields),
      preferences: asRecord(row.preferences),
      preferredLanguage: row.preferredLanguage,
      loyaltyPoints: row.loyaltyPoints,
      mergedIntoId: row.mergedIntoId,
      lifetimeValueMinor: Number(row.lifetimeValueMinor),
      totalBookings: row.totalBookings,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      city: row.city,
      account: row.account,
      _count: row._count,
    };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

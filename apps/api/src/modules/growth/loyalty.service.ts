import type { Prisma } from '@ac/database';
import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { GROWTH_CONFIG, type GrowthConfig } from './growth.config';
import { loyaltyPointsFor } from './growth.rules';

type Tx = Prisma.TransactionClient;

export interface CreditInput {
  tenantId: string;
  customerId: string;
  points: number;
  reason: string;
  refType?: string | null;
  refId?: string | null;
}

@Injectable()
export class LoyaltyService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(GROWTH_CONFIG) private readonly config: GrowthConfig,
  ) {}

  /**
   * Append a ledger entry and update the cached balance in one transaction.
   * Idempotent when `refType` + `refId` are supplied (returns null on replay).
   * Debits that would take the balance negative are rejected.
   */
  async post(input: CreditInput, tx?: Tx) {
    const run = async (db: Tx) => {
      if (input.refType && input.refId) {
        const dup = await db.loyaltyLedgerEntry.findFirst({
          where: {
            customerId: input.customerId,
            refType: input.refType,
            refId: input.refId,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (dup) return null;
      }
      const updated = await db.customer.update({
        where: { id: input.customerId },
        data: { loyaltyPoints: { increment: input.points } },
        select: { loyaltyPoints: true },
      });
      if (updated.loyaltyPoints < 0) {
        throw new UnprocessableEntityException('Insufficient loyalty balance');
      }
      return db.loyaltyLedgerEntry.create({
        data: {
          tenantId: input.tenantId,
          customerId: input.customerId,
          points: input.points,
          balanceAfter: updated.loyaltyPoints,
          reason: input.reason,
          refType: input.refType ?? null,
          refId: input.refId ?? null,
        },
      });
    };
    return tx ? run(tx) : this.prisma.client.$transaction(run);
  }

  /** Accrue points for a paid invoice (idempotent per invoice). */
  async accrueForInvoice(invoiceId: string) {
    const inv = await this.prisma.client.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, tenantId: true, customerId: true, number: true, amountPaidMinor: true, totalMinor: true },
    });
    if (!inv) return null;
    const points = loyaltyPointsFor(inv.amountPaidMinor || inv.totalMinor, this.config.loyaltyPointsPer100);
    if (points <= 0) return null;
    return this.post({
      tenantId: inv.tenantId,
      customerId: inv.customerId,
      points,
      reason: `Earned on invoice ${inv.number}`,
      refType: 'invoice',
      refId: inv.id,
    });
  }

  async statement(tenantId: string, customerId: string, take = 100) {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
      select: { loyaltyPoints: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    const entries = await this.prisma.client.loyaltyLedgerEntry.findMany({
      where: { tenantId, customerId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take,
      select: { id: true, points: true, reason: true, createdAt: true },
    });
    return {
      balance: customer.loyaltyPoints,
      entries: entries.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    };
  }
}

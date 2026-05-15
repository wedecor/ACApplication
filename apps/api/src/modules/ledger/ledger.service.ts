/**
 * Customer ledger service.
 *
 * Every financial event in the system writes one — and only one — row to
 * `customer_ledger_entries`. Rows are append-only; we never UPDATE/DELETE.
 *
 * `runningBalanceMinor` is a snapshot of the customer's balance AFTER this
 * entry was posted. Computing it requires us to read the previous entry
 * **under a row-lock** so concurrent writers can't pick the same prior
 * balance. Postgres' `SELECT ... FOR UPDATE` on the most-recent entry +
 * a Prisma transaction gives us serialisable behaviour.
 *
 * DEBIT (positive) → customer owes us (invoice, charge).
 * CREDIT (negative) → we owe / have received from customer (payment, refund).
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import {
  LedgerEntryDirection,
  type LedgerEntryType,
} from '@ac/types';

export interface PostLedgerEntryInput {
  tenantId: string;
  customerId: string;
  entryType: LedgerEntryType;
  direction: LedgerEntryDirection;
  amountMinor: number;
  currency?: string;
  description: string;
  invoiceId?: string | null;
  paymentId?: string | null;
  refundId?: string | null;
  creditNoteId?: string | null;
  amcSubscriptionId?: string | null;
  /** Idempotency token — caller-supplied; we dedupe per customer. */
  externalRef?: string;
  occurredAt?: Date;
}

export interface LedgerStatementOptions {
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  cursor?: string;
}

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomically post a ledger entry. Safe to call inside an outer transaction
   * (we use `prisma.$transaction(tx => ...)` only if the caller didn't pass
   * a transactional client).
   */
  async post(
    input: PostLedgerEntryInput,
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: string; runningBalanceMinor: number; skipped: boolean }> {
    const run = async (client: Prisma.TransactionClient) => {
      if (input.externalRef) {
        const existing = await client.customerLedgerEntry.findUnique({
          where: { customerId_externalRef: { customerId: input.customerId, externalRef: input.externalRef } },
          select: { id: true, runningBalanceMinor: true },
        });
        if (existing) {
          return { id: existing.id, runningBalanceMinor: existing.runningBalanceMinor, skipped: true };
        }
      }

      // Read the customer's previous balance with a row-lock — guarantees
      // concurrent writers see a stable snapshot.
      const latest = await client.$queryRaw<Array<{ runningBalanceMinor: number }>>`
        SELECT "runningBalanceMinor"
        FROM "customer_ledger_entries"
        WHERE "customerId" = ${input.customerId}
        ORDER BY "occurredAt" DESC, "id" DESC
        LIMIT 1
        FOR UPDATE
      `;
      const previousBalance = latest[0]?.runningBalanceMinor ?? 0;
      const delta = input.direction === LedgerEntryDirection.DEBIT ? input.amountMinor : -input.amountMinor;
      const running = previousBalance + delta;

      const created = await client.customerLedgerEntry.create({
        data: {
          tenantId: input.tenantId,
          customerId: input.customerId,
          entryType: input.entryType,
          direction: input.direction,
          amountMinor: input.amountMinor,
          currency: input.currency ?? 'INR',
          description: input.description,
          invoiceId: input.invoiceId ?? null,
          paymentId: input.paymentId ?? null,
          refundId: input.refundId ?? null,
          creditNoteId: input.creditNoteId ?? null,
          amcSubscriptionId: input.amcSubscriptionId ?? null,
          externalRef: input.externalRef ?? null,
          runningBalanceMinor: running,
          occurredAt: input.occurredAt ?? new Date(),
        },
        select: { id: true, runningBalanceMinor: true },
      });
      return { id: created.id, runningBalanceMinor: created.runningBalanceMinor, skipped: false };
    };

    if (tx) return run(tx);
    return this.prisma.client.$transaction(run, { isolationLevel: 'Serializable' });
  }

  async currentBalance(customerId: string): Promise<number> {
    const latest = await this.prisma.client.customerLedgerEntry.findFirst({
      where: { customerId },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      select: { runningBalanceMinor: true },
    });
    return latest?.runningBalanceMinor ?? 0;
  }

  async statement(customerId: string, opts: LedgerStatementOptions = {}) {
    const where: Prisma.CustomerLedgerEntryWhereInput = { customerId };
    if (opts.fromDate || opts.toDate) {
      where.occurredAt = {};
      if (opts.fromDate) where.occurredAt.gte = opts.fromDate;
      if (opts.toDate) where.occurredAt.lte = opts.toDate;
    }
    const limit = Math.min(opts.limit ?? 100, 500);
    const entries = await this.prisma.client.customerLedgerEntry.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const items = entries.slice(0, limit);
    return {
      items,
      nextCursor: entries.length > limit ? entries[limit - 1]!.id : null,
      currentBalanceMinor: items[0]?.runningBalanceMinor ?? 0,
    };
  }

  /**
   * Outstanding dues = sum of unpaid invoice balances. Faster + more
   * accurate than reading the ledger snapshot when reports want
   * "customer X owes us Y today".
   */
  async outstandingForCustomer(customerId: string): Promise<number> {
    const rows = await this.prisma.client.invoice.findMany({
      where: { customerId, dueAmountMinor: { gt: 0 }, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      select: { dueAmountMinor: true },
    });
    return rows.reduce((s, r) => s + r.dueAmountMinor, 0);
  }
}

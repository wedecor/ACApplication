import type { AuthPrincipal } from '@ac/auth';
import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { toAppPaymentMethodType } from './me.mappers';
import { MeContextService } from './me-context.service';

/**
 * Saved payment instruments. Rows hold gateway tokens only — card numbers
 * are never accepted, stored, returned or logged (the token itself is not
 * returned to the client either).
 */
@Injectable()
export class MePaymentMethodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: MeContextService,
  ) {}

  async list(actor: AuthPrincipal) {
    const customer = await this.ctx.requireCustomer(actor);
    const rows = await this.prisma.client.savedPaymentMethod.findMany({
      where: { tenantId: actor.tenantId, customerId: customer.id, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        gateway: true,
        type: true,
        label: true,
        last4: true,
        brand: true,
        isDefault: true,
        expiresAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      gateway: r.gateway,
      type: toAppPaymentMethodType(r.type),
      label: r.label,
      last4: r.last4,
      brand: r.brand,
      isDefault: r.isDefault,
      expiresAt: r.expiresAt?.toISOString() ?? null,
    }));
  }

  async setDefault(actor: AuthPrincipal, id: string): Promise<{ ok: true }> {
    const customer = await this.ctx.requireCustomer(actor);
    const method = await this.findOwned(actor.tenantId, customer.id, id);
    await this.prisma.client.$transaction([
      this.prisma.client.savedPaymentMethod.updateMany({
        where: { tenantId: actor.tenantId, customerId: customer.id, isDefault: true, NOT: { id: method.id } },
        data: { isDefault: false },
      }),
      this.prisma.client.savedPaymentMethod.update({ where: { id: method.id }, data: { isDefault: true } }),
    ]);
    return { ok: true };
  }

  async remove(actor: AuthPrincipal, id: string): Promise<{ ok: true }> {
    const customer = await this.ctx.requireCustomer(actor);
    const method = await this.findOwned(actor.tenantId, customer.id, id);
    await this.prisma.client.savedPaymentMethod.update({
      where: { id: method.id },
      data: { deletedAt: new Date(), isDefault: false },
    });
    if (method.isDefault) {
      const next = await this.prisma.client.savedPaymentMethod.findFirst({
        where: { tenantId: actor.tenantId, customerId: customer.id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (next) {
        await this.prisma.client.savedPaymentMethod.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }
    return { ok: true };
  }

  async refunds(actor: AuthPrincipal) {
    const customer = await this.ctx.requireCustomer(actor);
    const rows = await this.prisma.client.refund.findMany({
      where: { tenantId: actor.tenantId, customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        amountMinor: true,
        currency: true,
        status: true,
        reason: true,
        invoiceId: true,
        processedAt: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      amountMinor: r.amountMinor,
      currency: r.currency,
      status: r.status,
      reason: r.reason,
      invoiceId: r.invoiceId,
      processedAt: r.processedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  private async findOwned(tenantId: string, customerId: string, id: string) {
    const method = await this.prisma.client.savedPaymentMethod.findFirst({
      where: { id, tenantId, customerId, deletedAt: null },
      select: { id: true, isDefault: true },
    });
    if (!method) throw new NotFoundException('Payment method not found');
    return method;
  }
}

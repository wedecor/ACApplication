import type { AuthPrincipal } from '@ac/auth';
import { ForbiddenException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

export interface CustomerContext {
  id: string;
  tenantId: string;
  userId: string;
  fullName: string;
  phone: string;
  email: string | null;
  cityId: string | null;
  defaultAddressId: string | null;
}

/**
 * Resolves the Customer row behind the authenticated principal. Every
 * `/v1/me/*` handler starts here and then scopes all queries by the
 * returned `customer.id` + `tenantId` — that join is the ownership check.
 */
@Injectable()
export class MeContextService {
  constructor(private readonly prisma: PrismaService) {}

  async requireCustomer(actor: AuthPrincipal): Promise<CustomerContext> {
    const customer = await this.prisma.client.customer.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId, deletedAt: null },
      select: {
        id: true,
        tenantId: true,
        userId: true,
        fullName: true,
        phone: true,
        email: true,
        cityId: true,
        defaultAddressId: true,
      },
    });
    if (!customer) {
      throw new ForbiddenException('No customer profile linked to this account');
    }
    return customer;
  }
}

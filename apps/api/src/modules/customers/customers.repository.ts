import { Injectable } from '@nestjs/common';
import type { Prisma } from '@ac/database';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { ListCustomersDto } from './dto/list-customers.dto';

const CUSTOMER_INCLUDE = {
  city: { select: { id: true, name: true, state: true } },
  _count: { select: { bookings: true, invoices: true } },
} satisfies Prisma.CustomerInclude;

export type CustomerWithRelations = Prisma.CustomerGetPayload<{
  include: typeof CUSTOMER_INCLUDE;
}>;

@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(tenantId: string, id: string): Promise<CustomerWithRelations | null> {
    return this.prisma.client.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: CUSTOMER_INCLUDE,
    });
  }

  async list(
    tenantId: string,
    query: ListCustomersDto,
  ): Promise<{ items: CustomerWithRelations[]; total: number }> {
    const where: Prisma.CustomerWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query.cityId ? { cityId: query.cityId } : {}),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.customer.findMany({
        where,
        include: CUSTOMER_INCLUDE,
        orderBy: this.parseSort(query.sort ?? 'createdAt:desc'),
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.client.customer.count({ where }),
    ]);

    return { items, total };
  }

  private parseSort(sort: string): Prisma.CustomerOrderByWithRelationInput {
    const [field, dir] = sort.split(':');
    const direction = dir === 'asc' ? 'asc' : 'desc';
    switch (field) {
      case 'fullName':
        return { fullName: direction };
      case 'totalBookings':
        return { totalBookings: direction };
      case 'updatedAt':
        return { updatedAt: direction };
      default:
        return { createdAt: direction };
    }
  }
}

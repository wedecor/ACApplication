import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthPrincipal } from '@ac/auth';

import type { ListCustomersDto } from './dto/list-customers.dto';
import { CustomersRepository, type CustomerWithRelations } from './customers.repository';

export type CustomerListItem = ReturnType<CustomersService['serialize']>;

@Injectable()
export class CustomersService {
  constructor(private readonly repo: CustomersRepository) {}

  async list(actor: AuthPrincipal, query: ListCustomersDto) {
    const { items, total } = await this.repo.list(actor.tenantId, query);
    return {
      items: items.map((row) => this.serialize(row)),
      total,
    };
  }

  async get(actor: AuthPrincipal, id: string) {
    const row = await this.repo.findById(actor.tenantId, id);
    if (!row) throw new NotFoundException('Customer not found');
    return this.serialize(row);
  }

  private serialize(row: CustomerWithRelations) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      cityId: row.cityId,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      lifetimeValueMinor: Number(row.lifetimeValueMinor),
      totalBookings: row.totalBookings,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      city: row.city,
      _count: row._count,
    };
  }
}

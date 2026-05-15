import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Thin repository layer — keeps Prisma calls out of the service so we can
 * swap implementations or add caching/read-replicas later without touching
 * business logic.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.client.user.findUnique({ where: { id } });
  }

  findByPhone(phone: string) {
    return this.prisma.client.user.findUnique({ where: { phone } });
  }

  findByEmail(email: string) {
    return this.prisma.client.user.findUnique({ where: { email } });
  }
}

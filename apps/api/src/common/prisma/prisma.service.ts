import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createPrismaClient } from '@ac/database';
import { ClsService } from 'nestjs-cls';

/**
 * Prisma service that:
 *   - Injects the per-request actor via nestjs-cls so the audit extension
 *     can attribute writes correctly.
 *   - Handles connection lifecycle (connect on init, disconnect on shutdown).
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client: ReturnType<typeof createPrismaClient>;

  constructor(private readonly cls: ClsService) {
    this.client = createPrismaClient({
      getActor: () =>
        this.cls.get<{ userId?: string; tenantId?: string }>('actor') ?? null,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}

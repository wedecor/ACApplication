import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { LoadedServerEnv } from '@ac/config';
import type { RbacConsistencyReport, RbacHealthReport } from '@ac/auth';
import { assertRegistryValid, validateRegistry } from '@ac/auth';
import { auditRbacConsistency, syncAllTenantRbac, syncPermissionsFromSeed } from '@ac/database';

import { APP_CONFIG } from '../../common/config/config.module';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class RbacService implements OnModuleInit {
  private readonly logger = new Logger(RbacService.name);
  private lastSyncAt: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly env: LoadedServerEnv,
  ) {}

  async onModuleInit(): Promise<void> {
    assertRegistryValid();

    const isProd = this.env.NODE_ENV === 'production';
    const shouldSync = this.env.RBAC_SYNC_ON_STARTUP === true;
    const shouldValidate = this.env.RBAC_VALIDATE_ON_STARTUP !== false;

    if (shouldSync) {
      this.logger.log('RBAC_SYNC_ON_STARTUP — syncing permissions from registry…');
      await syncAllTenantRbac(this.prisma.client, { bumpVersionOnChange: false });
      this.lastSyncAt = new Date().toISOString();
    }

    if (shouldValidate) {
      const report = await auditRbacConsistency(this.prisma.client);
      if (!report.inSync) {
        const msg = this.formatDrift(report);
        if (isProd) {
          throw new Error(`RBAC consistency check failed at startup: ${msg}`);
        }
        this.logger.warn(`RBAC drift detected (development): ${msg}`);
      } else {
        this.logger.log('RBAC registry and database are in sync');
      }
    }
  }

  async getTenantRbacVersion(tenantId: string): Promise<number> {
    const tenant = await this.prisma.client.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { rbacVersion: true },
    });
    return tenant.rbacVersion;
  }

  async syncTenant(tenantId: string) {
    const result = await syncPermissionsFromSeed(this.prisma.client, tenantId);
    this.lastSyncAt = new Date().toISOString();
    return result;
  }

  async audit(tenantId?: string): Promise<RbacConsistencyReport> {
    return auditRbacConsistency(this.prisma.client, tenantId);
  }

  async health(tenantId?: string): Promise<RbacHealthReport> {
    const registry = validateRegistry();
    const registryIssues: string[] = [];
    if (registry.duplicatePermissionKeys.length) {
      registryIssues.push(`duplicates: ${registry.duplicatePermissionKeys.join(', ')}`);
    }
    if (registry.unknownRolePermissionKeys.length) {
      registryIssues.push(
        `unknown keys: ${registry.unknownRolePermissionKeys.map((x) => `${x.role}:${x.key}`).join(', ')}`,
      );
    }

    const consistency = await this.audit(tenantId);
    return {
      ...consistency,
      syncStatus: consistency.inSync ? 'ok' : 'drift_detected',
      registryValid: registry.valid,
      registryIssues,
      checkedAt: new Date().toISOString(),
    };
  }

  getLastSyncAt(): string | null {
    return this.lastSyncAt;
  }

  private formatDrift(report: RbacConsistencyReport): string {
    const parts: string[] = [];
    if (report.missingInDb.length) parts.push(`missingInDb=${report.missingInDb.length}`);
    if (report.orphanInDb.length) parts.push(`orphanInDb=${report.orphanInDb.length}`);
    if (report.staleRoles.length) parts.push(`staleRoles=${report.staleRoles.length}`);
    return parts.join(', ') || 'unknown drift';
  }
}

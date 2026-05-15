import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@ac/types';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import type { AuthPrincipal } from '@ac/auth';
import { RbacService } from './rbac.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/rbac', version: '1' })
export class RbacAdminController {
  constructor(private readonly rbac: RbacService) {}

  @Get('health')
  @RequirePermissions(Permission.ALL)
  @ApiOperation({ summary: 'RBAC registry vs database diagnostics' })
  async health(@CurrentUser() actor: AuthPrincipal, @Query('tenantId') tenantId?: string) {
    const report = await this.rbac.health(tenantId ?? actor.tenantId);
    return {
      ...report,
      permissionCount: report.dbPermissionCount,
      lastSyncAt: this.rbac.getLastSyncAt(),
    };
  }
}

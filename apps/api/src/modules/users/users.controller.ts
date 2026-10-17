import type { AuthPrincipal } from '@ac/auth';
import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AllowAuthenticated, CurrentUser } from '../../common/decorators';
import { PermissionsLoader } from '../auth/permissions.loader';
import { RbacService } from '../rbac/rbac.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly permissions: PermissionsLoader,
    private readonly rbac: RbacService,
  ) {}

  @AllowAuthenticated()
  @Get('me')
  @ApiOperation({ summary: 'Current user profile with effective permissions and active devices' })
  async me(@CurrentUser() principal: AuthPrincipal) {
    const profile = await this.users.profile(principal.userId, principal.tenantId, principal.sessionId ?? null);
    const auth = await this.permissions.loadForUser(principal.userId);
    const permissionVersion = await this.rbac.getTenantRbacVersion(principal.tenantId);
    return {
      ...profile,
      roles: auth.roles,
      permissions: auth.permissions,
      permissionVersion,
    };
  }

  @AllowAuthenticated()
  @Patch('me')
  @ApiOperation({ summary: 'Update my name / email / avatar (keeps the Customer profile in sync)' })
  update(@CurrentUser() principal: AuthPrincipal, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(principal.userId, principal.tenantId, dto);
  }
}

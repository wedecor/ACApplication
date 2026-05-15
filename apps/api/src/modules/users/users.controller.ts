import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AllowAuthenticated, CurrentUser } from '../../common/decorators';
import type { AuthPrincipal } from '@ac/auth';
import { PermissionsLoader } from '../auth/permissions.loader';
import { RbacService } from '../rbac/rbac.service';
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
  @ApiOperation({ summary: 'Current user profile with effective permissions' })
  async me(@CurrentUser() principal: AuthPrincipal) {
    const user = await this.users.getById(principal.userId);
    if (!user) throw new NotFoundException('User not found');
    const auth = await this.permissions.loadForUser(principal.userId);
    const permissionVersion = await this.rbac.getTenantRbacVersion(principal.tenantId);
    const { passwordHash: _ph, ...safe } = user;
    return {
      ...safe,
      roles: auth.roles,
      permissions: auth.permissions,
      permissionVersion,
    };
  }
}

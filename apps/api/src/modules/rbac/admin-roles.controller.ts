import type { AuthPrincipal } from '@ac/auth';
import { Permission } from '@ac/types';
import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { SetRolePermissionsDto, UpdateRoleDto } from './dto/roles.dto';
import { RolesService } from './roles.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/roles', version: '1' })
export class AdminRolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermissions(Permission.ROLE_MANAGE)
  @ApiOperation({ summary: 'List tenant roles with their permission keys.' })
  list(@CurrentUser() actor: AuthPrincipal) {
    return this.roles.list(actor);
  }

  @Get('permissions')
  @RequirePermissions(Permission.ROLE_MANAGE)
  @ApiOperation({ summary: 'All permission definitions grouped by resource.' })
  permissions() {
    return this.roles.permissionCatalog();
  }

  @Get(':id')
  @RequirePermissions(Permission.ROLE_MANAGE)
  @ApiOperation({ summary: 'Single role with permissions.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.roles.get(actor, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.ROLE_MANAGE)
  @ApiOperation({ summary: 'Rename / describe a role (SUPER_ADMIN is immutable).' })
  update(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roles.updateMeta(actor, id, dto);
  }

  @Put(':id/permissions')
  @RequirePermissions(Permission.ROLE_MANAGE)
  @ApiOperation({
    summary: "Replace a role's permission set (marks it customised, bumps tenant RBAC version).",
  })
  setPermissions(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: SetRolePermissionsDto,
  ) {
    return this.roles.setPermissions(actor, id, dto.permissionKeys);
  }

  @Post(':id/reset')
  @RequirePermissions(Permission.ROLE_MANAGE)
  @ApiOperation({ summary: 'Restore the registry default permissions for a role.' })
  reset(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.roles.resetToDefaults(actor, id);
  }
}

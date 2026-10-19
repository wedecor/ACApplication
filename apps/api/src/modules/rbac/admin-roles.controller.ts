import type { AuthPrincipal } from '@ac/auth';
import { Permission } from '@ac/types';
import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { CreateRoleDto, SetRolePermissionsDto, UpdateRoleDto } from './dto/roles.dto';
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

  @Post()
  @RequirePermissions(Permission.ROLE_MANAGE)
  @ApiOperation({ summary: 'Create a custom role with the given permissions (only ones you hold).' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateRoleDto) {
    return this.roles.create(actor, dto);
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

  @Delete(':id')
  @RequirePermissions(Permission.ROLE_MANAGE)
  @ApiOperation({ summary: 'Delete a custom role that no user holds (system roles cannot be deleted).' })
  remove(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.roles.remove(actor, id);
  }

  @Post(':id/reset')
  @RequirePermissions(Permission.ROLE_MANAGE)
  @ApiOperation({ summary: 'Restore the registry default permissions for a system role.' })
  reset(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.roles.resetToDefaults(actor, id);
  }
}

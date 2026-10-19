import type { AuthPrincipal } from '@ac/auth';
import { Permission } from '@ac/types';
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import {
  AssignUserRoleDto,
  CreateStaffUserDto,
  DeactivateStaffUserDto,
  ListStaffUsersDto,
  RevokeUserRoleParamsDto,
  SetUserRolesDto,
  UpdateStaffUserDto,
} from './dto/staff-users.dto';
import { StaffUsersService } from './staff-users.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/users', version: '1' })
export class AdminUsersController {
  constructor(private readonly users: StaffUsersService) {}

  @Get('assignable-roles')
  @RequirePermissions(Permission.USER_MANAGE)
  @ApiOperation({ summary: 'Staff roles with whether the caller may grant them.' })
  assignableRoles(@CurrentUser() actor: AuthPrincipal) {
    return this.users.assignableRoles(actor);
  }

  @Get()
  @RequirePermissions(Permission.USER_MANAGE)
  @ApiOperation({ summary: 'List staff (non-customer) users with their roles.' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() query: ListStaffUsersDto) {
    const { items, total } = await this.users.list(actor, query);
    return { items, pagination: buildPaginationMeta(query.page, query.pageSize, total) };
  }

  @Post()
  @RequirePermissions(Permission.USER_MANAGE)
  @ApiOperation({ summary: 'Create (invite) a staff user with roles — signs in via OTP.' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateStaffUserDto) {
    return this.users.create(actor, dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.USER_MANAGE)
  @ApiOperation({ summary: 'Staff user detail with roles and active session count.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.users.get(actor, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.USER_MANAGE)
  @ApiOperation({ summary: 'Update staff user profile fields.' })
  update(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body() dto: UpdateStaffUserDto) {
    return this.users.update(actor, id, dto);
  }

  @Put(':id/roles')
  @RequirePermissions(Permission.USER_MANAGE)
  @ApiOperation({ summary: 'Replace the staff roles of a user (bumps tenant RBAC version).' })
  setRoles(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body() dto: SetUserRolesDto) {
    return this.users.setRoles(actor, id, dto.roleKeys);
  }

  @Post(':id/roles')
  @RequirePermissions(Permission.USER_MANAGE)
  @ApiOperation({ summary: 'Assign one role to a user.' })
  assignRole(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body() dto: AssignUserRoleDto) {
    return this.users.assignRole(actor, id, dto.roleKey);
  }

  @Delete(':id/roles/:roleKey')
  @RequirePermissions(Permission.USER_MANAGE)
  @ApiOperation({ summary: 'Revoke one role from a user.' })
  revokeRole(
    @CurrentUser() actor: AuthPrincipal,
    @Param() params: RevokeUserRoleParamsDto,
  ) {
    return this.users.revokeRole(actor, params.id, params.roleKey);
  }

  @Post(':id/deactivate')
  @RequirePermissions(Permission.USER_MANAGE)
  @ApiOperation({ summary: 'Suspend a staff user and revoke their sessions.' })
  deactivate(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: DeactivateStaffUserDto,
  ) {
    return this.users.deactivate(actor, id, dto);
  }

  @Post(':id/reactivate')
  @RequirePermissions(Permission.USER_MANAGE)
  @ApiOperation({ summary: 'Re-enable a suspended staff user.' })
  reactivate(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.users.reactivate(actor, id);
  }

  @Post(':id/revoke-sessions')
  @RequirePermissions(Permission.USER_MANAGE)
  @ApiOperation({ summary: 'Sign the user out everywhere (revokes refresh sessions).' })
  revokeSessions(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.users.revokeSessions(actor, id);
  }
}

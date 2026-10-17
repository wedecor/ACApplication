import { Global, Module } from '@nestjs/common';

import { AdminRolesController } from './admin-roles.controller';
import { AdminUsersController } from './admin-users.controller';
import { RbacService } from './rbac.service';
import { RbacAdminController } from './rbac-admin.controller';
import { RolesService } from './roles.service';
import { StaffUsersService } from './staff-users.service';

@Global()
@Module({
  controllers: [RbacAdminController, AdminUsersController, AdminRolesController],
  providers: [RbacService, StaffUsersService, RolesService],
  exports: [RbacService],
})
export class RbacModule {}

import { Global, Module } from '@nestjs/common';

import { RbacAdminController } from './rbac-admin.controller';
import { RbacService } from './rbac.service';

@Global()
@Module({
  controllers: [RbacAdminController],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}

import { Injectable } from '@nestjs/common';
import type { Permission, UserRole } from '@ac/types';
import { UserStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

export interface LoadedUserAuth {
  roles: UserRole[];
  permissions: Permission[];
}

/**
 * Loads the current role + permission set from the database so JWT claims
 * stay in sync after seed or admin changes without forcing re-login.
 */
@Injectable()
export class PermissionsLoader {
  constructor(private readonly prisma: PrismaService) {}

  async loadForUser(userId: string): Promise<LoadedUserAuth> {
    const user = await this.prisma.client.user.findFirst({
      where: { id: userId, deletedAt: null, status: UserStatus.ACTIVE },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return { roles: [], permissions: [] };
    }

    const roles = user.roles.map((a) => a.role.key as UserRole);
    const permissionSet = new Set<Permission>();
    for (const assignment of user.roles) {
      for (const rp of assignment.role.permissions) {
        permissionSet.add(rp.permission.key as Permission);
      }
    }

    return { roles, permissions: [...permissionSet] };
  }
}

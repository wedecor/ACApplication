import type { Permission, RoleKey } from '@ac/types';
import { Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

export interface LoadedUserAuth {
  roles: RoleKey[];
  permissions: Permission[];
}

/**
 * Loads the current role + permission set from the database so JWT claims
 * stay in sync after seed or admin changes without forcing re-login.
 */
@Injectable()
export class PermissionsLoader {
  constructor(private readonly prisma: PrismaService) {}

  /** False once the session is revoked (logout, sign-out-everywhere) or expired. */
  async isSessionActive(sessionId: string): Promise<boolean> {
    const session = await this.prisma.client.session.findUnique({
      where: { id: sessionId },
      select: { revokedAt: true, expiresAt: true },
    });
    return Boolean(session && !session.revokedAt && session.expiresAt > new Date());
  }

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

    const roles = user.roles.map((a) => a.role.key);
    const permissionSet = new Set<Permission>();
    for (const assignment of user.roles) {
      for (const rp of assignment.role.permissions) {
        permissionSet.add(rp.permission.key as Permission);
      }
    }

    return { roles, permissions: [...permissionSet] };
  }
}

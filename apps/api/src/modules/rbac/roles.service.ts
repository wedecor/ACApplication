import type { AuthPrincipal } from '@ac/auth';
import { ROLE_PERMISSIONS } from '@ac/auth';
import type { UserRole } from '@ac/types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { UpdateRoleDto } from './dto/roles.dto';
import {
  effectivePermissions,
  groupPermissionsByResource,
  IMMUTABLE_ROLE_KEYS,
  lostSelfProtectedPermissions,
  permissionsAfterRoleEdit,
  samePermissionSet,
  ungrantablePermissions,
  WILDCARD,
} from './rbac-policy';
import { bumpTenantRbacVersion } from './rbac-version';

const ROLE_SELECT = {
  id: true,
  key: true,
  name: true,
  description: true,
  isSystem: true,
  createdAt: true,
  updatedAt: true,
  permissions: { select: { permission: { select: { id: true, key: true } } } },
  _count: { select: { users: true } },
} as const;

/**
 * Role ↔ permission administration.
 *
 * Roles are keyed by the `UserRole` enum, so the set of roles is fixed by the
 * schema (custom roles need a schema change). What admins *can* do is tailor
 * a role's permission set per tenant. Doing so flips `Role.isSystem` to
 * `false` ("customised"), which tells the registry sync / drift audit in
 * `@ac/database` to leave that role alone. `resetToDefaults` re-applies the
 * code registry and marks the role as registry-managed again.
 */
@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AuthPrincipal) {
    const rows = await this.prisma.client.role.findMany({
      where: { tenantId: actor.tenantId },
      select: ROLE_SELECT,
      orderBy: { key: 'asc' },
    });
    return rows.map(toRoleView);
  }

  async get(actor: AuthPrincipal, id: string) {
    const role = await this.prisma.client.role.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: ROLE_SELECT,
    });
    if (!role) throw new NotFoundException('Role not found');
    return toRoleView(role);
  }

  /** All permission definitions, grouped by resource for the matrix editor. */
  async permissionCatalog() {
    const defs = await this.prisma.client.permission.findMany({
      select: { id: true, key: true, resource: true, action: true, description: true },
      orderBy: { key: 'asc' },
    });
    const groups = groupPermissionsByResource(defs);
    return { total: defs.filter((d) => d.key !== WILDCARD).length, groups };
  }

  async updateMeta(actor: AuthPrincipal, id: string, dto: UpdateRoleDto) {
    const role = await this.loadRole(actor, id);
    this.assertMutable(role.key);
    await this.prisma.client.role.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description || null } : {}),
      },
      select: { id: true },
    });
    return this.get(actor, id);
  }

  async setPermissions(actor: AuthPrincipal, id: string, permissionKeys: string[]) {
    return this.applyPermissions(actor, id, [...new Set(permissionKeys)], { customised: true });
  }

  async resetToDefaults(actor: AuthPrincipal, id: string) {
    const role = await this.loadRole(actor, id);
    const defaults = ROLE_PERMISSIONS[role.key] ?? [];
    return this.applyPermissions(actor, id, defaults, { customised: false });
  }

  // --------------------------------------------------------------- helpers
  private async applyPermissions(
    actor: AuthPrincipal,
    id: string,
    keys: string[],
    opts: { customised: boolean },
  ) {
    const role = await this.loadRole(actor, id);
    this.assertMutable(role.key);

    if (keys.includes(WILDCARD)) {
      throw new BadRequestException('The wildcard permission is reserved for SUPER_ADMIN');
    }

    const defs = await this.prisma.client.permission.findMany({
      where: { key: { in: keys } },
      select: { id: true, key: true },
    });
    if (defs.length !== keys.length) {
      const known = new Set(defs.map((d) => d.key));
      const unknown = keys.filter((k) => !known.has(k));
      throw new BadRequestException(`Unknown permission key(s): ${unknown.join(', ')}`);
    }

    const currentKeys = role.permissions.map((p) => p.permission.key);
    const added = keys.filter((k) => !currentKeys.includes(k));
    const removed = currentKeys.filter((k) => !keys.includes(k));

    // Anti-escalation: you can only add or remove permissions you hold yourself.
    const blocked = ungrantablePermissions(actor.permissions, [...added, ...removed]);
    if (blocked.length) {
      throw new ForbiddenException(
        `You cannot grant or revoke permissions you do not hold: ${blocked.join(', ')}`,
      );
    }

    if (actor.roles.includes(role.key)) {
      const actorRoles = await this.loadActorRoles(actor);
      const before = effectivePermissions(actorRoles);
      const after = permissionsAfterRoleEdit(actorRoles, role.key, keys);
      const lost = lostSelfProtectedPermissions(before, after);
      if (lost.length) {
        throw new BadRequestException(
          `This change would remove your own ${lost.join(', ')} permission — ask another admin to make it`,
        );
      }
    }

    const permissionsChanged = added.length > 0 || removed.length > 0;
    // A role counts as registry-managed (isSystem) when it matches the code
    // registry — editing it back to the defaults un-customises it.
    const registryDefaults = ROLE_PERMISSIONS[role.key] ?? [];
    const nextIsSystem = opts.customised ? samePermissionSet(keys, registryDefaults) : true;
    if (!permissionsChanged && role.isSystem === nextIsSystem) return this.get(actor, id);

    const idByKey = new Map(defs.map((d) => [d.key, d.id]));
    const removedIds = role.permissions
      .filter((p) => removed.includes(p.permission.key))
      .map((p) => p.permission.id);

    await this.prisma.client.$transaction(async (tx) => {
      if (removedIds.length) {
        await tx.rolePermission.deleteMany({ where: { roleId: id, permissionId: { in: removedIds } } });
      }
      if (added.length) {
        await tx.rolePermission.createMany({
          data: added.map((k) => ({ roleId: id, permissionId: idByKey.get(k)! })),
          skipDuplicates: true,
        });
      }
      await tx.role.update({
        where: { id },
        data: { isSystem: nextIsSystem },
        select: { id: true },
      });
      if (permissionsChanged) await bumpTenantRbacVersion(tx, actor.tenantId);
    });

    return this.get(actor, id);
  }

  private async loadRole(actor: AuthPrincipal, id: string) {
    const role = await this.prisma.client.role.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: ROLE_SELECT,
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  private async loadActorRoles(actor: AuthPrincipal) {
    const assignments = await this.prisma.client.userRoleAssignment.findMany({
      where: { userId: actor.userId },
      select: {
        role: { select: { key: true, permissions: { select: { permission: { select: { key: true } } } } } },
      },
    });
    return assignments.map((a) => ({
      key: a.role.key,
      permissions: a.role.permissions.map((p) => p.permission.key),
    }));
  }

  private assertMutable(key: string): void {
    if (IMMUTABLE_ROLE_KEYS.includes(key as UserRole)) {
      throw new ForbiddenException(`${key} is a protected system role and cannot be modified`);
    }
  }
}

function toRoleView(role: {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  permissions: { permission: { key: string } }[];
  _count: { users: number };
}) {
  const permissionKeys = role.permissions.map((p) => p.permission.key).sort();
  const defaults = ROLE_PERMISSIONS[role.key as UserRole] ?? [];
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    /** true = permission set follows the code registry; false = tenant-customised. */
    isSystem: role.isSystem,
    isCustomised: !role.isSystem,
    isImmutable: IMMUTABLE_ROLE_KEYS.includes(role.key as UserRole),
    matchesDefaults: samePermissionSet(permissionKeys, defaults),
    permissionKeys,
    userCount: role._count.users,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

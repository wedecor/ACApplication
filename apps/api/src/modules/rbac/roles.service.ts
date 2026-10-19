import type { AuthPrincipal } from '@ac/auth';
import { ROLE_PERMISSIONS } from '@ac/auth';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { CreateRoleDto, UpdateRoleDto } from './dto/roles.dto';
import {
  customRoleKey,
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
  isCustom: true,
  createdAt: true,
  updatedAt: true,
  permissions: { select: { permission: { select: { id: true, key: true } } } },
  _count: { select: { users: true } },
} as const;

/** Upper bound on tenant-created roles, to keep the role picker usable. */
export const MAX_CUSTOM_ROLES = 50;

/**
 * Role ↔ permission administration.
 *
 * System roles (one per `UserRole`) come from the code registry. Admins can
 * tailor a system role's permission set per tenant; doing so flips
 * `Role.isSystem` to `false` ("customised"), which tells the registry sync /
 * drift audit in `@ac/database` to leave that role alone. `resetToDefaults`
 * re-applies the registry and marks the role as registry-managed again.
 *
 * Admins can also create custom roles (`isCustom`, key `CUSTOM_<NAME>`).
 * They have no registry defaults, are never touched by the sync, and can be
 * deleted once no user holds them. Authorization is permission-based, so a
 * custom role grants exactly the permissions ticked on it — nothing more.
 */
@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AuthPrincipal) {
    const rows = await this.prisma.client.role.findMany({
      where: { tenantId: actor.tenantId },
      select: ROLE_SELECT,
      orderBy: [{ isCustom: 'asc' }, { key: 'asc' }],
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

  /**
   * Creates a tenant-owned role. The same anti-escalation rule as editing
   * applies: every permission on the new role must be one the actor holds.
   */
  async create(actor: AuthPrincipal, dto: CreateRoleDto) {
    const name = dto.name.trim();
    const permissionKeys = [...new Set(dto.permissionKeys)];
    const existing = await this.prisma.client.role.findMany({
      where: { tenantId: actor.tenantId },
      select: { key: true, name: true, isCustom: true },
    });
    if (existing.filter((r) => r.isCustom).length >= MAX_CUSTOM_ROLES) {
      throw new BadRequestException(`A tenant can have at most ${MAX_CUSTOM_ROLES} custom roles`);
    }
    this.assertNameFree(existing, name);
    const defs = await this.loadPermissionDefs(permissionKeys);
    this.assertGrantable(actor, permissionKeys);

    const key = customRoleKey(name, new Set(existing.map((r) => r.key)));
    try {
      const role = await this.prisma.client.role.create({
        data: {
          tenantId: actor.tenantId,
          key,
          name,
          description: dto.description?.trim() || null,
          isSystem: false,
          isCustom: true,
          createdBy: actor.userId,
          updatedBy: actor.userId,
          permissions: { create: defs.map((d) => ({ permissionId: d.id })) },
        },
        select: { id: true },
      });
      return await this.get(actor, role.id);
    } catch (err) {
      // Two admins creating the same name at once: the (tenantId, key) unique index wins.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`A role named "${name}" already exists`);
      }
      throw err;
    }
  }

  /** Deletes a custom role. Refused while any user still holds it. */
  async remove(actor: AuthPrincipal, id: string) {
    const role = await this.loadRole(actor, id);
    if (!role.isCustom) {
      throw new ForbiddenException('System roles cannot be deleted — remove their permissions instead');
    }
    try {
      await this.prisma.client.$transaction(async (tx) => {
        const holders = await tx.userRoleAssignment.count({ where: { roleId: id } });
        if (holders > 0) {
          throw new ConflictException(
            `${role.name} is assigned to ${holders} user${holders === 1 ? '' : 's'} — remove it from them first`,
          );
        }
        // `delete`, not `deleteMany`: only single-row deletes reach the audit log.
        // Tenant ownership was checked by loadRole; role permissions cascade.
        await tx.role.delete({ where: { id }, select: { id: true } });
      });
    } catch (err) {
      // Deleted concurrently by another admin.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Role not found');
      }
      throw err;
    }
    return { id, deleted: true };
  }

  async updateMeta(actor: AuthPrincipal, id: string, dto: UpdateRoleDto) {
    const role = await this.loadRole(actor, id);
    this.assertMutable(role.key);
    if (dto.name !== undefined && dto.name.trim().toLowerCase() !== role.name.toLowerCase()) {
      const others = await this.prisma.client.role.findMany({
        where: { tenantId: actor.tenantId, id: { not: id } },
        select: { name: true },
      });
      this.assertNameFree(others, dto.name.trim());
    }
    await this.prisma.client.role.update({
      where: { id },
      data: {
        updatedBy: actor.userId,
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
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
    if (role.isCustom) {
      throw new BadRequestException('Custom roles have no default permissions to restore');
    }
    const defaults = registryDefaults(role.key);
    return this.applyPermissions(actor, id, defaults, { customised: false });
  }

  // --------------------------------------------------------------- helpers
  private async applyPermissions(
    actor: AuthPrincipal,
    id: string,
    keys: readonly string[],
    opts: { customised: boolean },
  ) {
    const role = await this.loadRole(actor, id);
    this.assertMutable(role.key);

    const defs = await this.loadPermissionDefs(keys);

    const currentKeys = role.permissions.map((p) => p.permission.key);
    const added = keys.filter((k) => !currentKeys.includes(k));
    const removed = currentKeys.filter((k) => !keys.includes(k));

    this.assertGrantable(actor, [...added, ...removed]);

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
    // A system role counts as registry-managed (isSystem) when it matches the
    // code registry — editing it back to the defaults un-customises it.
    // Custom roles are never registry-managed.
    const nextIsSystem = role.isCustom
      ? false
      : opts.customised
        ? samePermissionSet(keys, registryDefaults(role.key))
        : true;
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
        data: { isSystem: nextIsSystem, updatedBy: actor.userId },
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

  /** Resolves permission keys to rows; rejects the wildcard and unknown keys. */
  private async loadPermissionDefs(keys: readonly string[]) {
    if (keys.includes(WILDCARD)) {
      throw new BadRequestException('The wildcard permission is reserved for SUPER_ADMIN');
    }
    const defs = await this.prisma.client.permission.findMany({
      where: { key: { in: [...keys] } },
      select: { id: true, key: true },
    });
    if (defs.length !== keys.length) {
      const known = new Set(defs.map((d) => d.key));
      const unknown = keys.filter((k) => !known.has(k));
      throw new BadRequestException(`Unknown permission key(s): ${unknown.join(', ')}`);
    }
    return defs;
  }

  /** Anti-escalation: an actor can only add or remove permissions they hold. */
  private assertGrantable(actor: AuthPrincipal, keys: readonly string[]): void {
    const blocked = ungrantablePermissions(actor.permissions, keys);
    if (blocked.length) {
      throw new ForbiddenException(
        `You cannot grant or revoke permissions you do not hold: ${blocked.join(', ')}`,
      );
    }
  }

  private assertNameFree(roles: readonly { name: string }[], name: string): void {
    const lower = name.toLowerCase();
    if (roles.some((r) => r.name.toLowerCase() === lower)) {
      throw new ConflictException(`A role named "${name}" already exists`);
    }
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
    if (IMMUTABLE_ROLE_KEYS.includes(key)) {
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
  isCustom: boolean;
  createdAt: Date;
  updatedAt: Date;
  permissions: { permission: { key: string } }[];
  _count: { users: number };
}) {
  const permissionKeys = role.permissions.map((p) => p.permission.key).sort();
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    /** true = permission set follows the code registry; false = tenant-customised. */
    isSystem: role.isSystem,
    /** Tenant-created role: deletable, no registry defaults. */
    isCustom: role.isCustom,
    /** A system role whose permissions the tenant changed. */
    isCustomised: !role.isSystem && !role.isCustom,
    isImmutable: IMMUTABLE_ROLE_KEYS.includes(role.key),
    /** Custom roles have no defaults, so they always "match" them. */
    matchesDefaults: role.isCustom || samePermissionSet(permissionKeys, registryDefaults(role.key)),
    permissionKeys,
    userCount: role._count.users,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

/** Registry default permissions for a system role; none for custom roles. */
function registryDefaults(key: string): readonly string[] {
  return (ROLE_PERMISSIONS as Partial<Record<string, readonly string[]>>)[key] ?? [];
}

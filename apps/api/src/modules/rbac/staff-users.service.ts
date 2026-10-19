import type { AuthPrincipal } from '@ac/auth';
import { type RoleKey, UserRole, UserStatus } from '@ac/types';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthProvider, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  CreateStaffUserDto,
  DeactivateStaffUserDto,
  ListStaffUsersDto,
  UpdateStaffUserDto,
} from './dto/staff-users.dto';
import {
  effectivePermissions,
  lostSelfProtectedPermissions,
  PROFILE_MANAGED_ROLE_KEYS,
  type RolePermissionsLike,
  ungrantablePermissions,
} from './rbac-policy';
import { bumpTenantRbacVersion } from './rbac-version';

interface TenantRole extends RolePermissionsLike {
  id: string;
  key: RoleKey;
  name: string;
  description: string | null;
  isSystem: boolean;
}

const STAFF_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  avatarUrl: true,
  status: true,
  authProvider: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  technician: { select: { id: true, employeeCode: true } },
  roles: {
    select: {
      assignedAt: true,
      assignedBy: true,
      role: { select: { id: true, key: true, name: true } },
    },
  },
} satisfies Prisma.UserSelect;

type StaffUserRow = Prisma.UserGetPayload<{ select: typeof STAFF_USER_SELECT }>;

/**
 * Staff (non-customer) user administration for the admin CRM. Enforces:
 *  - anti-escalation: actors can only grant/revoke roles whose permissions they hold;
 *  - SUPER_ADMIN accounts can only be touched by another SUPER_ADMIN;
 *  - self-protection: no self-deactivation, no removing your own user/role management;
 *  - TECHNICIAN / CUSTOMER roles stay owned by their profile modules.
 */
@Injectable()
export class StaffUsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------ read
  async assignableRoles(actor: AuthPrincipal) {
    const roles = await this.loadTenantRoles(actor.tenantId);
    return roles
      .filter((r) => !PROFILE_MANAGED_ROLE_KEYS.includes(r.key))
      .map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        description: r.description,
        grantable: ungrantablePermissions(actor.permissions, r.permissions).length === 0,
      }));
  }

  async list(actor: AuthPrincipal, query: ListStaffUsersDto) {
    const and: Prisma.UserWhereInput[] = [
      {
        OR: [
          { roles: { some: { role: { key: { not: UserRole.CUSTOMER } } } } },
          { roles: { none: {} }, customer: { is: null } },
        ],
      },
    ];
    if (!query.includeTechnicians) and.push({ technician: { is: null } });
    if (query.roleKey) and.push({ roles: { some: { role: { key: query.roleKey } } } });
    if (query.status) and.push({ status: query.status });
    const search = query.search?.trim();
    if (search) {
      and.push({
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      });
    }
    const where: Prisma.UserWhereInput = { tenantId: actor.tenantId, AND: and };
    const now = new Date();

    const [rows, total] = await Promise.all([
      this.prisma.client.user.findMany({
        where,
        select: {
          ...STAFF_USER_SELECT,
          _count: { select: { sessions: { where: { revokedAt: null, expiresAt: { gt: now } } } } },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.client.user.count({ where }),
    ]);

    return {
      items: rows.map(({ _count, ...u }) => ({ ...toStaffView(u), activeSessions: _count.sessions })),
      total,
    };
  }

  async get(actor: AuthPrincipal, id: string) {
    const user = await this.prisma.client.user.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: STAFF_USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    const activeSessions = await this.prisma.client.session.count({
      where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    return { ...toStaffView(user), activeSessions };
  }

  // ----------------------------------------------------------------- write
  async create(actor: AuthPrincipal, dto: CreateStaffUserDto) {
    if (!dto.phone && !dto.email) {
      throw new BadRequestException('Provide a phone number or email so the user can sign in with OTP');
    }
    if (dto.phone) await this.assertUnique('phone', dto.phone);
    if (dto.email) await this.assertUnique('email', dto.email);

    const roles = await this.loadTenantRoles(actor.tenantId);
    const target = this.resolveStaffRoles(roles, dto.roleKeys);
    this.assertCanGrantRoles(actor, target);

    try {
      const user = await this.prisma.client.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            tenantId: actor.tenantId,
            firstName: dto.firstName,
            lastName: dto.lastName ?? null,
            phone: dto.phone ?? null,
            email: dto.email ?? null,
            status: UserStatus.ACTIVE,
            authProvider: AuthProvider.OTP,
            createdBy: actor.userId,
            updatedBy: actor.userId,
          },
          select: { id: true },
        });
        await tx.userRoleAssignment.createMany({
          data: target.map((r) => ({ userId: created.id, roleId: r.id, assignedBy: actor.userId })),
        });
        return created;
      });
      return await this.get(actor, user.id);
    } catch (err) {
      throw mapUniqueViolation(err);
    }
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateStaffUserDto) {
    const user = await this.loadTarget(actor, id);
    this.assertMayManage(actor, user);
    if (dto.phone && dto.phone !== user.phone) await this.assertUnique('phone', dto.phone, id);
    if (dto.email && dto.email !== user.email) await this.assertUnique('email', dto.email, id);

    const data: Prisma.UserUpdateInput = { updatedBy: actor.userId };
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName || null;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email;

    try {
      await this.prisma.client.user.update({ where: { id }, data, select: { id: true } });
    } catch (err) {
      throw mapUniqueViolation(err);
    }
    return this.get(actor, id);
  }

  /** Replaces the user's staff roles (profile-managed roles are preserved). */
  async setRoles(actor: AuthPrincipal, id: string, roleKeys: readonly RoleKey[]) {
    const user = await this.loadTarget(actor, id);
    this.assertMayManage(actor, user);
    const roles = await this.loadTenantRoles(actor.tenantId);
    const desiredStaff = this.resolveStaffRoles(roles, roleKeys);

    const currentIds = new Set(user.roles.map((a) => a.role.id));
    const preserved = roles.filter((r) => PROFILE_MANAGED_ROLE_KEYS.includes(r.key) && currentIds.has(r.id));
    const desiredIds = new Set([...desiredStaff, ...preserved].map((r) => r.id));

    const toAdd = roles.filter((r) => desiredIds.has(r.id) && !currentIds.has(r.id));
    const toRemove = roles.filter((r) => currentIds.has(r.id) && !desiredIds.has(r.id));
    if (toAdd.length === 0 && toRemove.length === 0) return this.get(actor, id);

    // Anti-escalation applies both ways: you cannot strip a role you couldn't grant.
    this.assertCanGrantRoles(actor, [...toAdd, ...toRemove]);

    if (id === actor.userId) {
      const before = effectivePermissions(roles.filter((r) => currentIds.has(r.id)));
      const after = effectivePermissions(roles.filter((r) => desiredIds.has(r.id)));
      const lost = lostSelfProtectedPermissions(before, after);
      if (lost.length) {
        throw new BadRequestException(`You cannot remove your own ${lost.join(', ')} permission`);
      }
    }

    await this.prisma.client.$transaction(async (tx) => {
      if (toRemove.length) {
        await tx.userRoleAssignment.deleteMany({
          where: { userId: id, roleId: { in: toRemove.map((r) => r.id) } },
        });
      }
      if (toAdd.length) {
        await tx.userRoleAssignment.createMany({
          data: toAdd.map((r) => ({ userId: id, roleId: r.id, assignedBy: actor.userId })),
          skipDuplicates: true,
        });
      }
      await tx.user.update({ where: { id }, data: { updatedBy: actor.userId }, select: { id: true } });
      await bumpTenantRbacVersion(tx, actor.tenantId);
    });
    return this.get(actor, id);
  }

  async assignRole(actor: AuthPrincipal, id: string, roleKey: RoleKey) {
    const user = await this.loadTarget(actor, id);
    const current = staffRoleKeys(user);
    if (current.includes(roleKey)) throw new ConflictException(`User already has role ${roleKey}`);
    return this.setRoles(actor, id, [...current, roleKey]);
  }

  async revokeRole(actor: AuthPrincipal, id: string, roleKey: RoleKey) {
    const user = await this.loadTarget(actor, id);
    const current = staffRoleKeys(user);
    if (!current.includes(roleKey)) throw new NotFoundException(`User does not have role ${roleKey}`);
    const next = current.filter((k) => k !== roleKey);
    if (next.length === 0) {
      throw new BadRequestException('A staff user must keep at least one role — deactivate the user instead');
    }
    return this.setRoles(actor, id, next);
  }

  async deactivate(actor: AuthPrincipal, id: string, dto: DeactivateStaffUserDto) {
    if (id === actor.userId) throw new BadRequestException('You cannot deactivate your own account');
    const user = await this.loadTarget(actor, id);
    this.assertMayManage(actor, user);
    if (user.status === UserStatus.SUSPENDED) throw new ConflictException('User is already deactivated');

    const sessionsRevoked = await this.prisma.client.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { status: UserStatus.SUSPENDED, updatedBy: actor.userId },
        select: { id: true },
      });
      const res = await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return res.count;
    });
    return { id, status: UserStatus.SUSPENDED, sessionsRevoked, reason: dto.reason ?? null };
  }

  async reactivate(actor: AuthPrincipal, id: string) {
    const user = await this.loadTarget(actor, id);
    this.assertMayManage(actor, user);
    if (user.status === UserStatus.ACTIVE) throw new ConflictException('User is already active');
    await this.prisma.client.user.update({
      where: { id },
      data: { status: UserStatus.ACTIVE, updatedBy: actor.userId },
      select: { id: true },
    });
    return this.get(actor, id);
  }

  /**
   * Revokes every refresh session and bumps the tenant RBAC version so the
   * user's outstanding access token is rejected on its next request.
   */
  async revokeSessions(actor: AuthPrincipal, id: string) {
    const user = await this.loadTarget(actor, id);
    this.assertMayManage(actor, user);
    const sessionsRevoked = await this.prisma.client.$transaction(async (tx) => {
      const res = await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (res.count > 0) await bumpTenantRbacVersion(tx, actor.tenantId);
      return res.count;
    });
    return { id, sessionsRevoked };
  }

  // --------------------------------------------------------------- helpers
  private async loadTarget(actor: AuthPrincipal, id: string): Promise<StaffUserRow> {
    const user = await this.prisma.client.user.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: STAFF_USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    const keys = user.roles.map((a) => a.role.key);
    if (keys.length > 0 && keys.every((k) => k === UserRole.CUSTOMER)) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private assertMayManage(actor: AuthPrincipal, user: StaffUserRow): void {
    const targetIsSuperAdmin = user.roles.some((a) => a.role.key === UserRole.SUPER_ADMIN);
    if (targetIsSuperAdmin && !actor.roles.includes(UserRole.SUPER_ADMIN)) {
      throw new ForbiddenException('Only a super admin can manage another super admin');
    }
  }

  private assertCanGrantRoles(actor: AuthPrincipal, roles: readonly TenantRole[]): void {
    const blocked = roles.filter((r) => ungrantablePermissions(actor.permissions, r.permissions).length > 0);
    if (blocked.length) {
      throw new ForbiddenException(
        `You cannot grant or revoke role(s) ${blocked.map((r) => r.key).join(', ')} — they include permissions you do not hold`,
      );
    }
  }

  private resolveStaffRoles(roles: readonly TenantRole[], keys: readonly RoleKey[]): TenantRole[] {
    const managed = keys.filter((k) => PROFILE_MANAGED_ROLE_KEYS.includes(k));
    if (managed.length) {
      throw new BadRequestException(
        `${managed.join(', ')} cannot be assigned here — onboard technicians from the Technicians page`,
      );
    }
    return keys.map((k) => {
      const role = roles.find((r) => r.key === k);
      if (!role) throw new BadRequestException(`Role ${k} is not provisioned for this tenant`);
      return role;
    });
  }

  private async loadTenantRoles(tenantId: string): Promise<TenantRole[]> {
    const rows = await this.prisma.client.role.findMany({
      where: { tenantId },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        isSystem: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
      orderBy: [{ isCustom: 'asc' }, { key: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissions: r.permissions.map((p) => p.permission.key),
    }));
  }

  private async assertUnique(field: 'phone' | 'email', value: string, exceptId?: string): Promise<void> {
    const where: Prisma.UserWhereUniqueInput = field === 'phone' ? { phone: value } : { email: value };
    // findUnique bypasses the soft-delete filter — both columns are globally unique.
    const existing = await this.prisma.client.user.findUnique({ where, select: { id: true } });
    if (existing && existing.id !== exceptId) {
      throw new ConflictException(`A user with this ${field} already exists`);
    }
  }
}

function staffRoleKeys(user: StaffUserRow): RoleKey[] {
  return user.roles
    .map((a) => a.role.key)
    .filter((k) => !PROFILE_MANAGED_ROLE_KEYS.includes(k));
}

function toStaffView(user: StaffUserRow) {
  const { roles, technician, ...rest } = user;
  return {
    ...rest,
    technicianId: technician?.id ?? null,
    roles: roles.map((a) => ({
      id: a.role.id,
      key: a.role.key,
      name: a.role.name,
      assignedAt: a.assignedAt,
      assignedBy: a.assignedBy,
    })),
  };
}

function mapUniqueViolation(err: unknown): unknown {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return new ConflictException('A user with this phone or email already exists');
  }
  return err;
}
